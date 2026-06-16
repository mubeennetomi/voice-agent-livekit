import asyncio
import json
import logging
import os

import aiohttp
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    TurnHandlingOptions,
    cli,
    inference,
    metrics,
    room_io,
)
from livekit.agents.beta.tools import EndCallTool
from livekit.agents.metrics import EOUMetrics, LLMMetrics, TTSMetrics
from livekit.plugins import (
    ai_coustics,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent-netomi-first-agent")

load_dotenv(".env.local")


# --- Defaults (used when the web app doesn't send config) --------------------
DEFAULT_INSTRUCTIONS = """You are a helpful, concise customer support voice agent for {Company}. Your job is to understand the customer's issue, gather the minimum necessary context, and either resolve the issue clearly or guide the customer to the right next step.

Goals:
- Understand what the customer is trying to do.
- Identify what went wrong or what information is missing.
- Resolve simple issues directly when possible.
- Escalate cleanly when the issue requires a human or a backend action.

Rules:
- Be calm, direct, and empathetic.
- Start by confirming the customer's goal in one sentence.
- Ask one or two focused questions at a time.
- Prefer concrete next steps over generic reassurance.
- Do not invent account details, order details, or policies.
- If the customer is frustrated, acknowledge that and stay practical.
- If you cannot complete the request, explain what the next best action is."""

DEFAULT_WELCOME = (
    "Hi, thanks for calling {Company} support. I can help with questions, "
    "troubleshooting, or account issues. What are you trying to do today?"
)


# --- Metrics reporting -------------------------------------------------------
METRICS_ENDPOINT = os.environ.get(
    "METRICS_ENDPOINT", "http://localhost:3000/api/metrics"
)
METRICS_INGEST_TOKEN = os.environ.get("METRICS_INGEST_TOKEN", "")


async def _post_samples(room: str, samples: list[dict]) -> None:
    if not samples:
        return
    headers = {"Content-Type": "application/json"}
    if METRICS_INGEST_TOKEN:
        headers["Authorization"] = f"Bearer {METRICS_INGEST_TOKEN}"
    try:
        async with aiohttp.ClientSession() as http:
            await http.post(
                METRICS_ENDPOINT,
                json={"room": room, "samples": samples},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            )
    except Exception as e:  # never let metrics reporting break the call
        logger.warning(f"metrics post failed: {e}")


def _samples_for(m) -> list[dict]:
    """Pull the numeric fields we care about and convert seconds -> ms."""
    s: list[dict] = []
    if isinstance(m, EOUMetrics):
        s.append({"name": "end_of_utterance_delay", "value": m.end_of_utterance_delay * 1000})
        s.append({"name": "transcription_delay", "value": m.transcription_delay * 1000})
    elif isinstance(m, LLMMetrics):
        s.append({"name": "ttft", "value": m.ttft * 1000})
    elif isinstance(m, TTSMetrics):
        s.append({"name": "ttfb", "value": m.ttfb * 1000})
    return [x for x in s if x["value"] and x["value"] > 0]


class ConfiguredAgent(Agent):
    def __init__(self, instructions: str, welcome: str, allow_interruptions: bool):
        super().__init__(
            instructions=instructions,
            tools=[
                EndCallTool(
                    extra_description="",
                    end_instructions=(
                        "Only end the call once the customer confirms they are done "
                        "or it is clear the next step has been handed off. Before "
                        "ending, summarize the resolution or next action in one or "
                        "two sentences."
                    ),
                    delete_room=False,
                )
            ],
        )
        self._welcome = welcome
        self._allow_interruptions = allow_interruptions

    async def on_enter(self):
        if self._welcome:
            await self.session.generate_reply(
                instructions=self._welcome,
                allow_interruptions=self._allow_interruptions,
            )


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


def _parse_config(metadata: str | None) -> dict:
    if not metadata:
        return {}
    try:
        return json.loads(metadata)
    except Exception:
        logger.warning("could not parse agent config metadata; using defaults")
        return {}


@server.rtc_session(agent_name="netomi-first-agent")
async def entrypoint(ctx: JobContext):
    cfg = _parse_config(ctx.job.metadata)
    logger.info(f"starting session with config keys: {list(cfg.keys())}")

    instructions = cfg.get("instructions") or DEFAULT_INSTRUCTIONS
    welcome = cfg.get("welcomeMessage") or DEFAULT_WELCOME
    allow_interruptions = cfg.get("allowInterruptions", True)

    tts_model = cfg.get("ttsModel") or "cartesia/sonic-3"
    tts_voice = cfg.get("ttsVoice") or "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
    llm_model = cfg.get("llmModel") or "openai/gpt-5.2-chat-latest"
    reasoning_effort = cfg.get("reasoningEffort") or ""
    stt_model = cfg.get("sttModel") or "deepgram/nova-3"
    stt_language = cfg.get("sttLanguage") or "en"
    noise_cancellation = cfg.get("noiseCancellation") or "none"
    background_audio = cfg.get("backgroundAudio") or "none"

    # LLM (only pass reasoning_effort when set — not every model supports it).
    if reasoning_effort:
        llm = inference.LLM(
            model=llm_model, extra_kwargs={"reasoning_effort": reasoning_effort}
        )
    else:
        llm = inference.LLM(model=llm_model)

    session = AgentSession(
        stt=inference.STT(model=stt_model, language=stt_language),
        llm=llm,
        tts=inference.TTS(model=tts_model, voice=tts_voice, language="en"),
        turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Report metrics to the web app (in addition to logging them).
    @session.on("metrics_collected")
    def _on_metrics(ev):
        metrics.log_metrics(ev.metrics)
        asyncio.create_task(_post_samples(ctx.room.name, _samples_for(ev.metrics)))

    # Noise cancellation (ai_coustics enhancer), resolved from config.
    audio_input = None
    if noise_cancellation and noise_cancellation != "none":
        model = getattr(ai_coustics.EnhancerModel, noise_cancellation, None)
        if model is not None:
            audio_input = room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(model=model)
            )
        else:
            logger.warning(f"unknown noise cancellation '{noise_cancellation}'")

    room_options = (
        room_io.RoomOptions(audio_input=audio_input)
        if audio_input
        else room_io.RoomOptions()
    )

    # Optional background audio.
    bg_player = None
    if background_audio == "office":
        try:
            from livekit.agents import (
                AudioConfig,
                BackgroundAudioPlayer,
                BuiltinAudioClip,
            )

            bg_player = BackgroundAudioPlayer(
                ambient_sound=AudioConfig(BuiltinAudioClip.OFFICE_AMBIENCE, volume=0.8)
            )
        except Exception as e:
            logger.warning(f"background audio unavailable: {e}")

    await session.start(
        agent=ConfiguredAgent(instructions, welcome, allow_interruptions),
        room=ctx.room,
        room_options=room_options,
    )

    if bg_player is not None:
        try:
            await bg_player.start(room=ctx.room, agent_session=session)
        except Exception as e:
            logger.warning(f"background audio start failed: {e}")


if __name__ == "__main__":
    cli.run_app(server)
