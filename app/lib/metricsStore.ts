// Per-room metrics store. Uses Vercel KV (Redis) when configured, so it works
// across serverless instances on Vercel; falls back to in-process memory for
// local dev (single Node server).

import { kv } from "@vercel/kv";

export type Sample = { name: string; value: number };

// Vercel injects KV_REST_API_URL when a KV store is connected to the project.
const USE_KV = !!process.env.KV_REST_API_URL;
const TTL_SECONDS = 60 * 60; // keep a room's metrics for an hour
const keyOf = (room: string) => `metrics:${room}`;

// In-memory fallback (local dev). Persisted on globalThis across hot-reloads.
const g = globalThis as unknown as { __lkMetrics?: Map<string, Sample[]> };
const mem: Map<string, Sample[]> = g.__lkMetrics ?? (g.__lkMetrics = new Map());

function clean(samples: Sample[]): Sample[] {
  return (samples ?? [])
    .filter((s) => typeof s?.name === "string" && Number.isFinite(s?.value))
    .map((s) => ({ name: s.name, value: s.value }));
}

export async function addSamples(room: string, samples: Sample[]): Promise<void> {
  const valid = clean(samples);
  if (!valid.length) return;
  if (USE_KV) {
    const key = keyOf(room);
    await kv.rpush(key, ...valid);
    await kv.expire(key, TTL_SECONDS);
  } else {
    const arr = mem.get(room) ?? [];
    arr.push(...valid);
    mem.set(room, arr);
  }
}

export type MetricAggregate = { count: number; avg: number; min: number; max: number };
export type RoomAggregate = { room: string; turns: number; metrics: Record<string, MetricAggregate> };

export async function getAggregate(room: string): Promise<RoomAggregate> {
  const samples: Sample[] = USE_KV
    ? ((await kv.lrange<Sample>(keyOf(room), 0, -1)) ?? [])
    : (mem.get(room) ?? []);

  const byName = new Map<string, number[]>();
  for (const s of samples) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s.value);
    byName.set(s.name, arr);
  }

  const metrics: Record<string, MetricAggregate> = {};
  for (const [name, values] of byName) {
    const sum = values.reduce((a, b) => a + b, 0);
    metrics[name] = { count: values.length, avg: sum / values.length, min: Math.min(...values), max: Math.max(...values) };
  }

  const turns =
    metrics["end_of_utterance_delay"]?.count ??
    Math.max(0, ...Object.values(metrics).map((m) => m.count));

  return { room, turns, metrics };
}
