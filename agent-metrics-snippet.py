# =============================================================================
# Paste this into your LiveKit agent (the "Code" tab / your agent.py).
#
# It listens for the agent's own metrics events and POSTs them to this demo's
# /api/metrics endpoint, tagged with the room name. The web page then fetches
# the aggregate from its own server when the call ends — nothing is measured in
# the browser.
#
# Works with livekit-agents 1.x (AgentSession). Values are converted to ms.
# =============================================================================

import asyncio
import os

import aiohttp
from livekit.agents import metrics
from livekit.agents.metrics import (
    EOUMetrics,
    LLMMetrics,
    TTSMetrics,
)

# Where to send metrics. Point this at your deployed demo, or use the localhost
# default while developing. NOTE: if your agent runs on LiveKit Cloud, it cannot
# reach your laptop's localhost — deploy the web app (e.g. to Vercel) and set
# METRICS_ENDPOINT to that public URL.
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
        print(f"[metrics] post failed: {e}")


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
    # drop any non-positive values (e.g. metrics that weren't applicable)
    return [x for x in s if x["value"] and x["value"] > 0]


# ---------------------------------------------------------------------------
# Wire it up inside your entrypoint, AFTER you create the AgentSession and
# BEFORE `await session.start(...)`. For the AgentServer API it looks like:
#
#   @server.rtc_session(agent_name="netomi-first-agent")
#   async def entrypoint(ctx: JobContext):
#       session = AgentSession(...)
#
#       @session.on("metrics_collected")
#       def _on_metrics(ev):
#           metrics.log_metrics(ev.metrics)  # keep the normal logging too
#           asyncio.create_task(
#               _post_samples(ctx.room.name, _samples_for(ev.metrics))
#           )
#
#       await session.start(agent=DefaultAgent(), room=ctx.room, ...)
# ---------------------------------------------------------------------------
