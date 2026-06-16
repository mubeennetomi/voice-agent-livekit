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
type Tab = "details" | "transcript" | "samples";

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

/* ---- Agent configuration + enhancements readout ---- */
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

/* ---- Latency metrics (after a call) ---- */
const METRIC_ROWS = [
  { name: "end_of_utterance_delay", label: "End of turn" },
  { name: "transcription_delay", label: "Transcription" },
  { name: "ttft", label: "LLM first token" },
  { name: "ttfb", label: "TTS first byte" },
];
function MetricsReadout({ room }: { room: string | null }) {
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

  if (!room) {
    return <div className="readout"><div className="rr-sec">Latency</div><div className="tx-empty">Appears after a call ends.</div></div>;
  }
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

/* ---- Transcript ---- */
function TranscriptView({ lines, live }: { lines: Line[]; live: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    <div className="transcript" ref={scrollRef}>
      {lines.length === 0 && <div className="tx-empty">The conversation will appear here once you start talking.</div>}
      {lines.map((l) => (
        <div key={l.id} className={"tline" + (l.agent ? " agent" : "")}>
          <span className="who">{l.who}</span>
          <span className="bubble">{l.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- Voice samples (dummy) ---- */
function VoiceSamples() {
  const samples = ["Greeting", "Handoff message", "Confirmation"];
  return (
    <div className="samples">
      <div className="tp-hint">Preview how the current voice sounds — no call needed.</div>
      {samples.map((s) => (
        <button key={s} className="sample" disabled>
          <span className="sample__play"><Icon name="speaker" size={14} /></span>
          <span className="sample__name">{s}</span>
          <span className="sample__soon">Coming soon</span>
        </button>
      ))}
    </div>
  );
}

/* ---- In-room live header (merged calling) ---- */
function LiveHeader({ onLeave, onTranscript }: { onLeave: () => void; onTranscript: (l: Line[]) => void }) {
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
    <div className="callhead callhead--live">
      <div className="cb-avatar"><Icon name="bot" size={18} /></div>
      <div className="cb-info">
        <div className="cb-name">Voice agent</div>
        <div className="cb-status">{stateLabel(state)} · {fmt(secs)}</div>
      </div>
      <div className="cb-viz"><BarVisualizer state={state} barCount={5} trackRef={audioTrack} options={{ minHeight: 8 }} /></div>
      <DisconnectButton className="btn-call" onClick={onLeave} aria-label="End call">
        <Icon name="phone" size={16} />
      </DisconnectButton>
      <RoomAudioRenderer />
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
  const [tab, setTab] = useState<Tab>("details");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const live = !!connectionDetails;
  const setLines = useMemo(() => (l: Line[]) => setTranscript(l), []);

  // Call starts → show Transcript. Call ends → nudge Details with a dot.
  useEffect(() => { if (live) setTab("transcript"); }, [live]);
  useEffect(() => { if (endedRoom && !live) setDetailsDirty(true); }, [endedRoom, live]);

  const openDetails = () => { setTab("details"); setDetailsDirty(false); };
  const start = () => { setTranscript([]); setDetailsDirty(false); onStart(); };

  return (
    <aside className="testpane">
      {/* Calling merged into the header */}
      <div className="tp-callhead">
        {live ? (
          <LiveKitRoom
            token={connectionDetails!.participantToken}
            serverUrl={connectionDetails!.serverUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={onDisconnected}
          >
            <LiveHeader onLeave={onDisconnected} onTranscript={setLines} />
          </LiveKitRoom>
        ) : (
          <div className="callhead">
            <span className="callhead__title"><Icon name="phone" size={15} /> Test call</span>
            <button className="btn-start btn-start--sm" onClick={start} disabled={connecting}>
              <Icon name="headset" size={15} /> {connecting ? "Connecting…" : endedRoom ? "Start again" : "Start call"}
            </button>
          </div>
        )}
      </div>
      {error && <div className="tp-error">{error}</div>}

      {/* Tabs + dummy Voice samples button */}
      <div className="tp-tabrow">
        <div className="tp-tabs2">
          <button className="tp-tab2" data-on={tab === "details"} onClick={openDetails}>
            Details {detailsDirty && <span className="tp-dot" aria-label="updated" />}
          </button>
          <button className="tp-tab2" data-on={tab === "transcript"} onClick={() => setTab("transcript")}>
            Transcript
          </button>
        </div>
        <button className="tp-samplesbtn" data-on={tab === "samples"} onClick={() => setTab("samples")}>
          <Icon name="speaker" size={14} /> Voice samples
        </button>
      </div>

      <div className="tp-body">
        {tab === "details" && (
          <>
            <ConfigReadout config={config} />
            <MetricsReadout room={endedRoom} />
          </>
        )}
        {tab === "transcript" && <TranscriptView lines={transcript} live={live} />}
        {tab === "samples" && <VoiceSamples />}

        {endedRoom && !live && tab !== "details" && (
          <button className="tp-detailscta" onClick={openDetails}>
            View call details →
          </button>
        )}
      </div>
    </aside>
  );
}
