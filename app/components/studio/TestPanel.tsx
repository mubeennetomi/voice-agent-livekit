"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useTrackTranscription,
  useLocalParticipant,
  DisconnectButton,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Icon } from "./Icon";
import type { ConnectionDetails } from "../../api/connection-details/route";
import type { RoomAggregate } from "../../lib/metricsStore";

function stateLabel(s: string): string {
  switch (s) {
    case "connecting": return "Connecting…";
    case "initializing": return "Waking agent…";
    case "listening": return "Listening";
    case "thinking": return "Thinking…";
    case "speaking": return "Speaking";
    default: return s;
  }
}

/* ---- In-room live UI (inside LiveKitRoom) ---- */
function LiveCall({ onLeave }: { onLeave: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const { segments: userSegments } = useTrackTranscription({
    publication: localParticipant.getTrackPublication(Track.Source.Microphone),
    source: Track.Source.Microphone,
    participant: localParticipant,
  });

  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

  const lines = [
    ...(agentTranscriptions ?? []).map((s) => ({ id: "a" + s.id, who: "Agent", agent: true, text: s.text, t: s.firstReceivedTime })),
    ...(userSegments ?? []).map((s) => ({ id: "u" + s.id, who: "You", agent: false, text: s.text, t: s.firstReceivedTime })),
  ].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

  return (
    <>
      <div className="callbar live">
        <div className="cb-live">
          <div className="cb-avatar"><Icon name="bot" size={19} /></div>
          <div className="cb-info">
            <div className="cb-name">Voice agent</div>
            <div className="cb-status">{stateLabel(state)} · {fmt(secs)}</div>
          </div>
          <DisconnectButton className="btn-call" onClick={onLeave} aria-label="End call">
            <Icon name="phone" size={17} />
          </DisconnectButton>
        </div>
        <div className="cb-viz">
          <BarVisualizer state={state} barCount={7} trackRef={audioTrack} options={{ minHeight: 8 }} />
        </div>
      </div>

      <div className="tx-col">
        <div className="tx-col-head">
          <span><Icon name="transcript" size={15} /> Transcript</span>
          <span className="tx-state live">Live</span>
        </div>
        <div className="transcript">
          {lines.length === 0 && <div className="tx-empty">The conversation will appear here once you start talking.</div>}
          {lines.map((l) => (
            <div key={l.id} className={"tline" + (l.agent ? " agent" : "")}>
              <span className="who">{l.who}</span>
              <span className="bubble">{l.text}</span>
            </div>
          ))}
        </div>
      </div>
      <RoomAudioRenderer />
    </>
  );
}

/* ---- Metrics readout (after a call) ---- */
const METRIC_ROWS: { name: string; label: string }[] = [
  { name: "end_of_utterance_delay", label: "End of turn" },
  { name: "transcription_delay", label: "Transcription" },
  { name: "ttft", label: "LLM first token" },
  { name: "ttfb", label: "TTS first byte" },
];

function MetricsReadout({ room }: { room: string }) {
  const [data, setData] = useState<RoomAggregate | null>(null);
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      try {
        const res = await fetch(`/api/metrics?room=${encodeURIComponent(room)}`);
        const json = (await res.json()) as RoomAggregate;
        if (!cancelled) setData(json);
        if (!cancelled && json.turns === 0 && tries < 5) { tries++; setTimeout(poll, 1000); }
      } catch { /* ignore */ }
    };
    poll();
    return () => { cancelled = true; };
  }, [room]);

  const present = METRIC_ROWS.filter((r) => data?.metrics[r.name]);
  return (
    <div className="readout">
      <div className="rr-sec">Latency · last call</div>
      {!data && <div className="rr-row"><span className="rr-k">Loading…</span></div>}
      {data && data.turns === 0 && (
        <div className="rr-row"><span className="rr-k">No metrics reported</span><span className="rr-v rr-v--blank">—</span></div>
      )}
      {data && data.turns > 0 && (
        <>
          <div className="rr-row rr-row--total"><span className="rr-k">Turns</span><span className="rr-v">{data.turns}</span></div>
          {present.map((r) => (
            <div key={r.name} className="rr-row">
              <span className="rr-k">{r.label}</span>
              <span className="rr-v">{Math.round(data.metrics[r.name].avg)} ms</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function TestPanel({ connectionDetails, connecting, error, endedRoom, onStart, onDisconnected }: {
  connectionDetails: ConnectionDetails | null;
  connecting: boolean;
  error: string | null;
  endedRoom: string | null;
  onStart: () => void;
  onDisconnected: () => void;
}) {
  return (
    <aside className="testpane">
      <div className="tp-tabs">
        <button className="tp-tab" data-on={true}><Icon name="phone" size={15} /> Live call</button>
      </div>
      <div className="tp-body">
        {connectionDetails ? (
          <LiveKitRoom
            token={connectionDetails.participantToken}
            serverUrl={connectionDetails.serverUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={onDisconnected}
          >
            <LiveCall onLeave={onDisconnected} />
          </LiveKitRoom>
        ) : (
          <>
            <div className="callbar">
              <div className="cb-idle">
                <div className="wave">{[12, 18, 8, 20, 14, 22, 10].map((h, i) => <i key={i} style={{ height: h }} />)}</div>
                <div className="cb-idle__txt">Talk to your agent in a two-way WebRTC call. Allow mic access when prompted.</div>
                <button className="btn-start" onClick={onStart} disabled={connecting}>
                  <Icon name="headset" size={16} /> {connecting ? "Connecting…" : endedRoom ? "Start again" : "Start call"}
                </button>
              </div>
            </div>
            {endedRoom && <MetricsReadout room={endedRoom} />}
            {error && <div className="tp-error">{error}</div>}
          </>
        )}
      </div>
    </aside>
  );
}
