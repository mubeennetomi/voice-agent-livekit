# Deploy the agent to LiveKit Cloud

This makes **our** agent (metrics + config-from-the-webpage) the one that answers
deployed calls — replacing the Builder-deployed agent that doesn't have our code.

## Prerequisites

- LiveKit CLI installed: `brew install livekit-cli` (or see livekit.io/cli)
- Authenticated to your project: `lk cloud auth` (follow the browser prompt)

## 1. Create + deploy the agent

From this `agent/` folder:

```bash
cd agent
lk agent create        # registers a new Cloud agent; generates livekit.toml
lk agent deploy        # builds the Dockerfile and deploys
```

`lk agent create` will ask for a name/region — **pick a region close to you** (this
is what fixes the latency; the Builder agent was in India West).

## 2. Set the agent's environment variables

In the **LiveKit Cloud dashboard → Agents → (your agent) → Settings → Secrets**
(or via the CLI), add:

```
METRICS_ENDPOINT     = https://<your-app>.vercel.app/api/metrics
METRICS_INGEST_TOKEN = <same token as in Vercel>
AGENT_NAME           = netomi-first-agent
```

> LiveKit Cloud injects `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
> automatically — don't set those. Models use LiveKit Inference, so no other
> provider keys are needed.

Redeploy if you added secrets after the first deploy: `lk agent deploy`.

## 3. Kill the cold start

In the dashboard, set the agent's **minimum instances / replicas to 1** so a warm
worker is always ready. This removes the slow-first-call delay.

## 4. Point the web app at this agent

In **Vercel → Settings → Environment Variables**, confirm:

```
LIVEKIT_AGENT_NAME   = netomi-first-agent   (must equal AGENT_NAME above)
METRICS_INGEST_TOKEN = <same token>
```

Also connect a **KV store** (Storage → Create → KV) so `KV_REST_API_URL` /
`KV_REST_API_TOKEN` exist — that's what makes metrics persist. Then **redeploy** on
Vercel.

## 5. Retire the Builder agent (important)

Both agents register the same name and LiveKit load-balances between them — so
delete/stop the old **Builder-deployed** agent in the dashboard. Otherwise ~half
your calls still hit the no-metrics agent.

(Alternatively, give this agent a unique `AGENT_NAME` and set the same unique value
as `LIVEKIT_AGENT_NAME` in Vercel — then you can leave the Builder agent alone.)

## Verify

```bash
lk agent status        # should show your agent running (1 replica)
lk agent logs          # watch for "registered worker" and, during a call,
                       # "resolved agent config" + metrics posts
```

Then make a call from the Vercel app: first call is fast (warm), the agent honors
your webpage settings, and the **Metrics** tab fills in.
