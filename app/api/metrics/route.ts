import { NextRequest, NextResponse } from "next/server";
import { addSamples, getAggregate, type Sample } from "@/app/lib/metricsStore";

export const revalidate = 0;

// Optional shared secret so only your agent can post metrics.
const INGEST_TOKEN = process.env.METRICS_INGEST_TOKEN;

// --- Agent pushes metrics here --------------------------------------------
// Body: { "room": "demo-room-123", "samples": [{ "name": "ttft", "value": 480 }] }
// Values are expected in milliseconds.
export async function POST(req: NextRequest) {
  if (INGEST_TOKEN) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${INGEST_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { room?: string; samples?: Sample[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.room || !Array.isArray(body.samples)) {
    return NextResponse.json(
      { error: "Expected { room: string, samples: [{name, value}] }" },
      { status: 400 },
    );
  }

  await addSamples(body.room, body.samples);
  return NextResponse.json({ ok: true, received: body.samples.length });
}

// --- Browser reads the aggregate when the call ends -----------------------
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  if (!room) {
    return NextResponse.json({ error: "Missing ?room=" }, { status: 400 });
  }
  return NextResponse.json(await getAggregate(room), {
    headers: { "Cache-Control": "no-store" },
  });
}
