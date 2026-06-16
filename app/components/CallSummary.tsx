"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomAggregate } from "../lib/metricsStore";

// Friendly labels + display order for the metrics the agent reports.
// Anything else the agent sends still shows up, just with its raw name.
const KNOWN: { name: string; label: string }[] = [
  { name: "e2e_latency", label: "Avg E2E latency" },
  { name: "transcription_delay", label: "Avg transcription delay" },
  { name: "end_of_utterance_delay", label: "Avg end of turn delay" },
  { name: "ttft", label: "Avg LLM time to first token" },
  { name: "ttfb", label: "Avg TTS time to first byte" },
];

export function CallSummary({
  room,
  onRestart,
}: {
  room: string;
  onRestart: () => void;
}) {
  const [data, setData] = useState<RoomAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics?room=${encodeURIComponent(room)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load metrics");
      setData(json as RoomAggregate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [room]);

  // Metrics may land a beat after disconnect — fetch, and retry briefly if empty.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const run = async () => {
      await load();
      tries += 1;
    };
    run();
    const id = setInterval(async () => {
      if (cancelled) return;
      const res = await fetch(`/api/metrics?room=${encodeURIComponent(room)}`);
      const json = (await res.json()) as RoomAggregate;
      if (cancelled) return;
      setData(json);
      setLoading(false);
      tries += 1;
      if (json.turns > 0 || tries >= 5) clearInterval(id);
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [room, load]);

  const metricEntries = data
    ? orderMetrics(Object.keys(data.metrics))
    : [];

  return (
    <div className="summary">
      <h1 className="title">Call ended</h1>

      {loading && !data && <p className="subtitle">Fetching metrics…</p>}
      {error && <p className="error">{error}</p>}

      {data && data.turns === 0 && !loading && (
        <p className="subtitle">
          No metrics were reported for this call. Make sure your agent posts to{" "}
          <code>/api/metrics</code> (see the README) and that you completed at
          least one turn.
        </p>
      )}

      {data && data.turns > 0 && (
        <>
          <p className="subtitle">
            Reported by your LiveKit agent across {data.turns} turn
            {data.turns === 1 ? "" : "s"}.
          </p>

          <div className="metric-grid">
            {metricEntries.map((name) => {
              const m = data.metrics[name];
              return (
                <div key={name} className="metric-card">
                  <span className="metric-label">{labelFor(name)}</span>
                  <span className="metric-value">
                    {Math.round(m.avg).toLocaleString()}
                    <span className="metric-unit"> ms</span>
                  </span>
                  <span className="metric-sub">
                    min {Math.round(m.min)} · max {Math.round(m.max)} · n{" "}
                    {m.count}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button className="start-button" onClick={onRestart}>
        Start a new call
      </button>
    </div>
  );
}

function labelFor(name: string): string {
  return KNOWN.find((k) => k.name === name)?.label ?? name;
}

function orderMetrics(names: string[]): string[] {
  const known = KNOWN.map((k) => k.name).filter((n) => names.includes(n));
  const rest = names.filter((n) => !KNOWN.some((k) => k.name === n)).sort();
  return [...known, ...rest];
}
