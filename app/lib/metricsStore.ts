// Simple in-memory metrics store, keyed by room name.
//
// The agent POSTs metric samples here during the call; the browser reads the
// aggregate once the call ends. Stored on globalThis so it survives Next.js
// hot-reloads in dev.
//
// NOTE: this lives in the memory of a single server instance. That's perfect
// for local dev and a single long-running Node server. On a serverless host
// (e.g. Vercel) ingest and read can land on different instances — swap this
// module for Redis/Upstash there.

export type Sample = { name: string; value: number };

type Store = Map<string, Sample[]>;

const g = globalThis as unknown as { __lkMetrics?: Store };
const store: Store = g.__lkMetrics ?? (g.__lkMetrics = new Map());

const MAX_SAMPLES_PER_ROOM = 2000;

export function addSamples(room: string, samples: Sample[]): void {
  const existing = store.get(room) ?? [];
  for (const s of samples) {
    if (typeof s?.name === "string" && Number.isFinite(s?.value)) {
      existing.push({ name: s.name, value: s.value });
    }
  }
  // Bound memory in case a session runs very long.
  if (existing.length > MAX_SAMPLES_PER_ROOM) {
    existing.splice(0, existing.length - MAX_SAMPLES_PER_ROOM);
  }
  store.set(room, existing);
}

export type MetricAggregate = {
  count: number;
  avg: number;
  min: number;
  max: number;
};

export type RoomAggregate = {
  room: string;
  turns: number;
  metrics: Record<string, MetricAggregate>;
};

export function getAggregate(room: string): RoomAggregate {
  const samples = store.get(room) ?? [];
  const byName = new Map<string, number[]>();
  for (const s of samples) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s.value);
    byName.set(s.name, arr);
  }

  const metrics: Record<string, MetricAggregate> = {};
  for (const [name, values] of byName) {
    const sum = values.reduce((a, b) => a + b, 0);
    metrics[name] = {
      count: values.length,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  // One "end of turn" measurement is emitted per user turn, so its count is a
  // good proxy for the number of turns. Fall back to the largest sample count.
  const turns =
    metrics["end_of_utterance_delay"]?.count ??
    Math.max(0, ...Object.values(metrics).map((m) => m.count));

  return { room, turns, metrics };
}

export function clearRoom(room: string): void {
  store.delete(room);
}
