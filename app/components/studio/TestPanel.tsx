"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  type AgentConfig,
  NOISE_CANCELLATION,
  BACKGROUND_AUDIO,
  VOICES_BY_PROVIDER,
} from "../../lib/agentConfig";

type Line = { id: string; who: string; agent: boolean; text: string; t: number };

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

function labelOf(options: { value: string; label: string }[], v: string) {
  return options.find((o) => o.value === v)?.label ?? v;
}

/* ---- Agent configuration + enhancements readout (always on top) ---- */
function ConfigReadout({ config }: { config: AgentConfig }) {
  const split = (id: string) => {
    const i = id.indexOf("/");
    return i === -1 ? ["", id] : [id.slice(0, i), id.slice(i + 1)];
  };
  const [sttP, sttM] = split(config.sttModel);
  const [llmP, llmM] = split(config.llmModel);
  const [ttsP, ttsM] = split(config.ttsModel);
  const voiceLabel = config.ttsVoice
    ? (VOICES_BY_PROVIDER[ttsP]?.find((v) => v.value === config.ttsVoice)?.label ?? config.ttsVoice)
    : "Provider default";
  const nc = config.noiseCancellation;

  const Row = ({ k, v, indent, on }: { k: string; v: string; indent?: boolean; on?: boolean }) => (
    <div className={"rr-row" + (indent ? " rr-row--indent" : "")}>
      <span className="rr-k">{k}</span>
      <span className={"rr-v" + (on ? " rr-v--on" : "")}>{v}</span>
    </div>
  );

  return (
    <div className="readout">
      <div className="rr-sec">Agent configuration</div>
      <Row k="VAD" v="Silero" />
      <Row k="Speech-to-text" v={sttP || "—"} />
      <Row k="Model" v={sttM} indent />
      <Row k="Language model" v={llmP || "—"} />
      <Row k="Model" v={llmM} indent />
      <Row k="Text-to-speech" v={ttsP || "—"} />
      <Row k="Model" v={ttsM} indent />
      <Row k="Voice" v={voiceLabel} indent />
      <div className="rr-div" />
      <div className="rr-sec">Enhancements</div>
      <Row k="Turn detection" v="Multilingual" on />
      <Row k="Interruptions" v={config.allowInterruptions ? "On" : "Off"} on={config.allowInterruptions} />
      <Row k="Noise cancellation" v={nc === "none" ? "Off" : labelOf(NOISE_CANCELLATION, nc)} on={nc !== "none"} />
      <Row k="Background audio" v={labelOf(BACKGROUND_AUDIO, config.backgroundAudio)} />
    </div>
  );
}

/* ---- In-room bridge: live call bar + reports transcript upward ---- */
function RoomBridge({ onLeave, onTranscript }: { onLeave: () => void; onTranscript: (lines: Line[]) => void }) {
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

  useEffect(() => {
    const lines: Line[] = [
      ...(agentTranscriptions ?? []).map((s) => ({ id: "a" + s.id, who: "Agent", agent: true, text: s.text, t: s.firstReceivedTime ?? 0 })),
      ...(userSegments ?? []).map((s) => ({ id: "u" + s.id, who: "You", agent: false, text: s.text, t: s.firstReceivedTime ?? 0 })),
    ].sort((a, b) => a.t - b.t);
    onTranscript(lines);
  }, [agentTranscriptions, userSegments, onTranscript]);

  return (
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
      <RoomAudioRenderer />
    </div>
  );
}

/* ---- Transcript view (persists after the call) ---- */
function TranscriptView({ lines, live }: { lines: Line[]; live: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Auto-scroll to the newest line as the transcript grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="tx-col">
      <div className="tx-col-head">
        <span><Icon name="transcript" size={15} /> Transcript</span>
        <span className={"tx-state" + (live ? " live" : "")}>{live ? "Live" : lines.length ? "Ended" : "Idle"}</span>
      </div>
      <div className="transcript" ref={scrollRef}>
        {lines.length === 0 && <div className="tx-empty">The conversation will appear here once you start talking.</div>}
        {lines.map((l) => (
          <div key={l.id} className={"tline" + (l.agent ? " agent" : "")}>
            <span className="who">{l.who}</span>
            <span className="bubble">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Latency metrics (after a call) ---- */
const METRIC_ROWS = [
  { name: "end_of_utterance_delay", label: "End of turn" },
  { name: "transcription_delay", label: "Transcription" },
  { name: "ttft", label: "LLM first token" },
  { name: "ttfb", label: "TTS first byte" },
];

function MetricsView({ room }: { room: string | null }) {
  const [data, setData] = useState<RoomAggregate | null>(null);
  useEffect(() => {
    setData(null);
    if (!room) return;
    let cancelled = false; let tries = 0;
    const poll = async () => {
      try {
        const res = await fetch(`/api/metrics?room=${encodeURIComponent(room)}`);
        const json = (await res.json()) as RoomAggregate;
        if (cancelled) return;
        setData(json);
        if (json.turns === 0 && tries < 5) { tries++; setTimeout(poll, 1000); }
      } catch { /* ignore */ }
    };
    poll();
    return () => { cancelled = true; };
  }, [room]);

  if (!room) return <div className="tx-empty" style={{ padding: 24 }}>Latency appears here after a call ends.</div>;
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

export function TestPanel({ config, connectionDetails, connecting, error, endedRoom, onStart, onDisconnected }: {
  config: AgentConfig;
  connectionDetails: ConnectionDetails | null;
  connecting: boolean;
  error: string | null;
  endedRoom: string | null;
  onStart: () => void;
  onDisconnected: () => void;
}) {
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [tab, setTab] = useState<"transcript" | "metrics">("transcript");
  const live = !!connectionDetails;

  const start = () => { setTranscript([]); onStart(); };
  // useMemo so RoomBridge's onTranscript reference stays stable
  const setLines = useMemo(() => (lines: Line[]) => setTranscript(lines), []);

  return (
    <aside className="testpane">
      <div className="tp-tabs">
        <button className="tp-tab" data-on={true}><Icon name="phone" size={15} /> Test call</button>
      </div>
      <div className="tp-body">
        {live ? (
          <LiveKitRoom
            token={connectionDetails!.participantToken}
            serverUrl={connectionDetails!.serverUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={onDisconnected}
          >
            <RoomBridge onLeave={onDisconnected} onTranscript={setLines} />
          </LiveKitRoom>
        ) : (
          <div className="callbar">
            <div className="cb-idle">
              <div className="wave">{[12, 18, 8, 20, 14, 22, 10].map((h, i) => <i key={i} style={{ height: h }} />)}</div>
              <div className="cb-idle__txt">Talk to your agent in a two-way WebRTC call. Allow mic access when prompted.</div>
              <button className="btn-start" onClick={start} disabled={connecting}>
                <Icon name="headset" size={16} /> {connecting ? "Connecting…" : endedRoom ? "Start again" : "Start call"}
              </button>
            </div>
          </div>
        )}
        {error && <div className="tp-error">{error}</div>}

        {/* Transcript + metrics appear once a call has started, above the
            config readout so the transcript is visible right away. */}
        {(live || endedRoom) && (
          <>
            <div className="tp-subtabs">
              <button className="tp-subtab" data-on={tab === "transcript"} onClick={() => setTab("transcript")}>Transcript</button>
              <button className="tp-subtab" data-on={tab === "metrics"} onClick={() => setTab("metrics")}>Metrics</button>
            </div>
            {tab === "transcript"
              ? <TranscriptView lines={transcript} live={live} />
              : <MetricsView room={endedRoom} />}
          </>
        )}

        <ConfigReadout config={config} />
      </div>
    </aside>
  );
}
