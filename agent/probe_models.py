import asyncio
import json
import os

from dotenv import load_dotenv
from livekit.agents import APIConnectOptions, inference
from livekit.agents.llm import ChatContext

load_dotenv(".env.local")

HERE = os.path.dirname(__file__)
OPTS = os.path.join(HERE, "..", "app", "lib", "livekitOptions.json")
with open(OPTS) as f:
    data = json.load(f)

models = [m["value"] for m in data["llm_models"]]
sem = asyncio.Semaphore(6)


async def probe(model: str) -> tuple[str, str]:
    async with sem:
        try:
            llm = inference.LLM(model=model)
            ctx = ChatContext.empty()
            ctx.add_message(role="user", content="Reply with the single word: hi")
            stream = llm.chat(
                chat_ctx=ctx,
                conn_options=APIConnectOptions(max_retry=0, timeout=12),
            )
            got = False
            async for _ in stream:
                got = True
            await stream.aclose()
            return model, "OK" if got else "EMPTY"
        except Exception as e:
            return model, f"FAIL {type(e).__name__}: {str(e)[:70]}"


async def main():
    results = await asyncio.gather(*(probe(m) for m in models))
    ok = [m for m, r in results if r == "OK"]
    bad = [(m, r) for m, r in results if r != "OK"]
    print("\n===== WORKING =====")
    for m in ok:
        print("OK  ", m)
    print("\n===== NOT WORKING =====")
    for m, r in bad:
        print(r, "->", m)
    print(f"\n{len(ok)}/{len(models)} models OK")
    print("WORKING_JSON=" + json.dumps(ok))


asyncio.run(main())
