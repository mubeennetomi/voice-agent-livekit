# LiveKit Voice Agent Demo

A minimal Next.js web page that starts a **live voice call with your LiveKit agent** from the browser.

## How it works

```
Browser  ──fetch──►  /api/connection-details  ──mints──►  access token
   │                  (server, has your API secret)        (with explicit
   │                                                         agent dispatch)
   └──connect (token)──►  LiveKit Cloud room  ◄──dispatched──  your agent worker
                          (your mic ⇄ agent audio)
```

- The browser **never sees your API secret**. The token route signs a short-lived
  JWT server-side.
- The token includes a `RoomConfiguration` with a `RoomAgentDispatch`, so LiveKit
  **explicitly dispatches your named agent** into the room the moment you connect.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Add your credentials.** Edit `.env.local`:

   ```
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_AGENT_NAME=your-agent-name
   ```

   Find the key/secret/URL in the [LiveKit Cloud dashboard](https://cloud.livekit.io)
   under **Settings → Keys**.

   `LIVEKIT_AGENT_NAME` must match the `agent_name` your worker registers with.
   In a Python agent that's:

   ```python
   agents.cli.run_app(
       agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="your-agent-name")
   )
   ```

   > **Note:** Once you give a worker an `agent_name`, LiveKit stops dispatching it
   > automatically — it only joins rooms that explicitly request it (which this
   > app does). If your agent currently has no `agent_name`, either add one, or use
   > automatic dispatch (delete the `at.roomConfig = ...` block in
   > `app/api/connection-details/route.ts` and leave `LIVEKIT_AGENT_NAME` blank).

3. **Make sure your agent worker is running** and connected to the same LiveKit
   project (e.g. `python agent.py dev`).

4. **Run the web app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, click **Start call**, allow microphone access, and
   talk to your agent.

## Deploying

Deploy to Vercel (or any Node host). Set the same four environment variables in
the host's settings. The token route runs server-side, so secrets stay private.

## Metrics (fetched server-side, not measured in the browser)

The latency numbers you see in the LiveKit playground (E2E latency, transcription
delay, end-of-turn delay) are computed **inside your agent** by the agents
framework. There is **no LiveKit REST API to poll** for them, so the flow is:

```
your agent  ──POST /api/metrics──►  this app's server (stores per room)
                                              ▲
browser  ──GET /api/metrics?room=X (on hang-up)──┘   (just renders; measures nothing)
```

To enable it:

1. **Add the reporter to your agent.** Open `agent-metrics-snippet.py`, copy the
   helpers, and add the `@session.on("metrics_collected")` handler to your agent's
   entrypoint (instructions are in the file).

2. **Give the agent two env vars** (in the agent's environment, not this app):

   ```
   METRICS_ENDPOINT=https://your-deployed-demo.com/api/metrics
   METRICS_INGEST_TOKEN=<same value as in .env.local>
   ```

   ⚠️ If your agent runs on **LiveKit Cloud**, it can't reach `localhost` — deploy
   this web app (e.g. Vercel) and point `METRICS_ENDPOINT` at the public URL.

3. **Set `METRICS_INGEST_TOKEN`** in `.env.local` to the same random string, so
   only your agent can post.

When a call ends, the summary screen fetches the aggregate from `/api/metrics` and
shows avg / min / max per metric.

> **Serverless note:** the store in `app/lib/metricsStore.ts` is in-process memory
> — fine for local dev and a single Node server, but on Vercel the POST and GET can
> hit different instances. Swap it for Redis/Upstash for production.

## Files

- `app/api/connection-details/route.ts` — mints the token + explicit dispatch
- `app/api/metrics/route.ts` — agent POSTs metrics here; browser GETs the aggregate
- `app/lib/metricsStore.ts` — in-memory per-room metric store + aggregation
- `app/page.tsx` — connect / disconnect flow
- `app/components/VoiceAssistant.tsx` — visualizer, mic controls, live transcript
- `app/components/CallSummary.tsx` — end-of-call screen, fetches server metrics
- `agent-metrics-snippet.py` — paste into your agent to report metrics
