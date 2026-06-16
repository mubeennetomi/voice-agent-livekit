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
            # Speak the welcome message verbatim (like the playground), instead
            # of asking the LLM to generate a greeting from it.
            await self.session.say(
                self._welcome,
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


def _resolve_noise_cancellation(value: str):
    """Map a UI value (quail-* via ai_coustics, krisp-* via the Krisp plugin)
    to a noise-cancellation object, or None."""
    if not value or value == "none":
        return None
    if value.startswith("quail"):
        # quail-vf-l -> QUAIL_VF_L
        name = value.upper().replace("-", "_")
        model = getattr(ai_coustics.EnhancerModel, name, None)
        if model is None:
            logger.warning(f"unknown ai_coustics model '{value}'")
            return None
        return ai_coustics.audio_enhancement(model=model)
    if value.startswith("krisp"):
        try:
            from livekit.plugins import noise_cancellation as nc
        except Exception as e:
            logger.warning(f"Krisp noise cancellation plugin not installed: {e}")
            return None
        factory = {
            "krisp-bvc": getattr(nc, "BVC", None),
            "krisp-bvc-telephony": getattr(nc, "BVCTelephony", None),
            "krisp-nc": getattr(nc, "NC", None),
        }.get(value)
        if factory is None:
            logger.warning(f"unknown Krisp model '{value}'")
            return None
        return factory()
    logger.warning(f"unknown noise cancellation '{value}'")
    return None


# UI background-audio value -> BuiltinAudioClip member name.
_BG_CLIPS = {
    "office-ambience.ogg": "OFFICE_AMBIENCE",
    "city-ambience.ogg": "CITY_AMBIENCE",
    "forest-ambience.ogg": "FOREST_AMBIENCE",
    "crowded-room.ogg": "CROWDED_ROOM",
}


def _resolve_background_audio(value: str):
    if not value or value == "none":
        return None
    try:
        from livekit.agents import (
            AudioConfig,
            BackgroundAudioPlayer,
            BuiltinAudioClip,
        )
    except Exception as e:
        logger.warning(f"background audio unavailable: {e}")
        return None
    clip_name = _BG_CLIPS.get(value)
    if clip_name is None:
        logger.warning(
            f"background audio '{value}' has no local built-in clip; skipping"
        )
        return None
    clip = getattr(BuiltinAudioClip, clip_name, None)
    if clip is None:
        return None
    return BackgroundAudioPlayer(ambient_sound=AudioConfig(clip, volume=0.8))


@server.rtc_session(agent_name="netomi-first-agent")
async def entrypoint(ctx: JobContext):
    cfg = _parse_config(ctx.job.metadata)

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
    if reasoning_effort and reasoning_effort != "none":
        llm = inference.LLM(
            model=llm_model, extra_kwargs={"reasoning_effort": reasoning_effort}
        )
    else:
        llm = inference.LLM(model=llm_model)

    # Voice is provider-specific; omit it when blank to use the provider default.
    tts = (
        inference.TTS(model=tts_model, voice=tts_voice, language="en")
        if tts_voice
        else inference.TTS(model=tts_model, language="en")
    )

    session = AgentSession(
        stt=inference.STT(model=stt_model, language=stt_language),
        llm=llm,
        tts=tts,
        turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Report metrics to the web app (in addition to logging them).
    @session.on("metrics_collected")
    def _on_metrics(ev):
        metrics.log_metrics(ev.metrics)
        asyncio.create_task(_post_samples(ctx.room.name, _samples_for(ev.metrics)))

    # Noise cancellation (Quail via ai_coustics, Krisp via plugin), from config.
    nc = _resolve_noise_cancellation(noise_cancellation)
    room_options = (
        room_io.RoomOptions(audio_input=room_io.AudioInputOptions(noise_cancellation=nc))
        if nc is not None
        else room_io.RoomOptions()
    )

    # Optional background audio.
    bg_player = _resolve_background_audio(background_audio)

    # Observability: a readable summary of what THIS call used. Shows up as the
    # agent participant's attributes (LiveKit "Participants" view) and in logs.
    attributes = {
        "cfg.llm": llm_model,
        "cfg.reasoning_effort": reasoning_effort or "default",
        "cfg.stt": f"{stt_model} ({stt_language})",
        "cfg.tts": f"{tts_model} / {tts_voice}",
        "cfg.noise_cancellation": noise_cancellation,
        "cfg.background_audio": background_audio,
        "cfg.allow_interruptions": str(allow_interruptions),
    }
    logger.info(f"resolved agent config for {ctx.room.name}: {json.dumps(attributes)}")
    logger.info(
        f"instructions ({len(instructions)} chars): {instructions[:200]!r}..."
    )
    logger.info(f"welcome message: {welcome!r}")

    await session.start(
        agent=ConfiguredAgent(instructions, welcome, allow_interruptions),
        room=ctx.room,
        room_options=room_options,
    )

    # Set after start so the agent participant is connected.
    try:
        await ctx.room.local_participant.set_attributes(attributes)
    except Exception as e:
        logger.warning(f"could not set participant attributes: {e}")

    if bg_player is not None:
        try:
            await bg_player.start(room=ctx.room, agent_session=session)
        except Exception as e:
            logger.warning(f"background audio start failed: {e}")


if __name__ == "__main__":
    cli.run_app(server)
