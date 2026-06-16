# Local agent (with metrics reporting)

This is your `netomi-first-agent`, identical to the sandbox version, plus a
`metrics_collected` handler that POSTs latency metrics to the web demo's
`/api/metrics` endpoint. Run it locally so you can edit it (the sandbox Code tab
is read-only).

## Setup

```bash
cd agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Credentials live in `agent/.env.local` (already filled in with your LiveKit
project keys + the metrics token, which matches the web app's `.env.local`).

## Run

```bash
# 1) In the project root, start the web app:
#      npm run dev
# 2) Here, start the agent worker:
python agent.py dev
```

Now open http://localhost:3000, click **Start call**, talk, then **End call** —
the summary shows the metrics this agent reported.

## Notes

- The worker registers as `netomi-first-agent`. Your web app requests that agent
  by name (explicit dispatch), so this local worker handles the call. Use the web
  app for calls (not the sandbox preview) so your local agent is the one running.
- If a plugin import fails, pin versions in `requirements.txt` to match the
  sandbox (its `pip list` / `requirements` will show them).
- Metrics never block the call — if the POST fails you'll see a
  `metrics post failed` warning in this worker's logs and nothing else breaks.
