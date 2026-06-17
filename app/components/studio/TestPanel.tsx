"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
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
const AGENT_NAME = "Test voice agent";

const fmtDur = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const labelOf = (opts: { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v;

function voiceName(config: AgentConfig): string {
  const provider = config.ttsModel.split("/")[0];
  if (!config.ttsVoice) return "the default voice";
  const label = VOICES_BY_PROVIDER[provider]?.find((v) => v.value === config.ttsVoice)?.label;
  return label ? label.split(" — ")[0] : "this voice";
}

/* ---- Ash card (consistent header across idle / live / ended) ---- */
function AshCard({ subtitle, viz, button }: { subtitle: string; viz: ReactNode; button: ReactNode }) {
  return (
    <div className="ash-card">
      <div className="avatar"><Icon name="bot" size={20} /></div>
      <div className="ash-info">
        <div className="ash-name">{AGENT_NAME}</div>
        <div className="ash-sub">{subtitle}</div>
      </div>
      {viz}
      {button}
    </div>
  );
}

const IdleBars = () => (
  <div className="bars idle"><span /><span /><span /><span /><span /></div>
);
const ActiveBars = () => (
  <div className="bars active"><span /><span /><span /><span /><span /></div>
);

/* ---- In-room: live header (captures transcript) ---- */
function LiveAshCard({ onLeave, onTranscript, onTick }: {
  onLeave: () => void; onTranscript: (l: Line[]) => void; onTick: (s: number) => void;
}) {
  const { agentTranscriptions } = useVoiceAssistant();
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
  useEffect(() => { onTick(secs); }, [secs, onTick]);

  useEffect(() => {
    const lines: Line[] = [
      ...(agentTranscriptions ?? []).map((s) => ({ id: "a" + s.id, who: "Agent", agent: true, text: s.text, t: s.firstReceivedTime ?? 0 })),
      ...(userSegments ?? []).map((s) => ({ id: "u" + s.id, who: "You", agent: false, text: s.text, t: s.firstReceivedTime ?? 0 })),
    ].sort((a, b) => a.t - b.t);
    onTranscript(lines);
  }, [agentTranscriptions, userSegments, onTranscript]);

  return (
    <>
      <AshCard
        subtitle={`Call in progress · ${fmtDur(secs)}`}
        viz={<ActiveBars />}
        button={
          <DisconnectButton className="call-btn red" onClick={onLeave} aria-label="End call">
            <Icon name="phoneoff" size={17} />
          </DisconnectButton>
        }
      />
      <RoomAudioRenderer />
    </>
  );
}

/* ---- Details (agent config + enhancements + latency) ---- */
const METRIC_ROWS = [
  { name: "end_of_utterance_delay", label: "End of turn" },
  { name: "transcription_delay", label: "Transcription" },
  { name: "ttft", label: "LLM first token" },
  { name: "ttfb", label: "TTS first byte" },
];

function CallDetails({ config, room }: { config: AgentConfig; room: string | null }) {
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

  const split = (id: string) => {
    const i = id.indexOf("/");
    return i === -1 ? ["", id] : [id.slice(0, i), id.slice(i + 1)];
  };
  const [sttP, sttM] = split(config.sttModel);
  const [llmP, llmM] = split(config.llmModel);
  const [ttsP, ttsM] = split(config.ttsModel);
  const nc = config.noiseCancellation;

  const configSection = (
    <>
      <div>
        <div className="section-title">Agent configuration</div>
        <div className="row"><span className="k">VAD</span><span className="v">Silero</span></div>
        <div className="row"><span className="k">Speech-to-text</span><span className="v">{sttP || "—"}</span></div>
        <div className="row sub"><span className="k">Model</span><span className="v">{sttM}</span></div>
        <div className="row"><span className="k">Language model</span><span className="v">{llmP || "—"}</span></div>
        <div className="row sub"><span className="k">Model</span><span className="v">{llmM}</span></div>
        <div className="row"><span className="k">Text-to-speech</span><span className="v">{ttsP || "—"}</span></div>
        <div className="row sub"><span className="k">Model</span><span className="v">{ttsM}</span></div>
        <div className="row sub"><span className="k">Voice</span><span className="v">{voiceName(config)}</span></div>
      </div>
      <div className="divider" />
      <div>
        <div className="section-title">Enhancements</div>
        <div className="row"><span className="k">Turn detection</span><span className="v">On</span></div>
        <div className="row"><span className="k">Interruptions</span><span className="v">{config.allowInterruptions ? "On" : "Off"}</span></div>
        <div className="row"><span className="k">Noise cancellation</span><span className="v">{nc === "none" ? "Off" : labelOf(NOISE_CANCELLATION, nc)}</span></div>
        <div className="row"><span className="k">Background audio</span><span className="v">{labelOf(BACKGROUND_AUDIO, config.backgroundAudio)}</span></div>
      </div>
    </>
  );

  const hasMetrics = !!data && data.turns > 0;
  const overall = hasMetrics ? METRIC_ROWS.reduce((s, r) => s + (data!.metrics[r.name]?.avg ?? 0), 0) : 0;
  const latencySection = (
    <div>
      <div className="section-title">Latency{hasMetrics ? " · last call" : ""}</div>
      {METRIC_ROWS.map((r) => {
        const m = data?.metrics[r.name];
        return (
          <div key={r.name} className="row">
            <span className="k">{r.label}</span>
            <span className={"v" + (m ? "" : " muted")}>{m ? Math.round(m.avg) + " ms" : "—"}</span>
          </div>
        );
      })}
      <div className="row">
        <span className="k">Overall</span>
        <span className={"v" + (overall > 0 ? "" : " muted")}>{overall > 0 ? Math.round(overall) + " ms" : "—"}</span>
      </div>
    </div>
  );

  // After a call, surface latency at the top and highlight it as new.
  return room ? (
    <>
      <div className="detail-new">{latencySection}</div>
      <div className="divider" />
      {configSection}
    </>
  ) : (
    <>
      {configSection}
      <div className="divider" />
      {latencySection}
    </>
  );
}

/* ---- Transcript ---- */
function TranscriptBlock({ lines, live }: { lines: Line[]; live: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);
  const stateLabel = live ? "Live" : lines.length ? "Ended" : "Idle";
  return (
    <>
      <div className="transcript-head">
        <span className="section-title" style={{ margin: 0 }}>Conversation</span>
        <span className={"pill" + (live ? " pill-live" : "")}><span className="dot" />{stateLabel}</span>
      </div>
      <div className="transcript" ref={scrollRef}>
        {lines.length === 0 && <div className="tx-empty">The conversation will appear here once the call starts.</div>}
        {lines.map((l) => (
          <div key={l.id} className={"msg " + (l.agent ? "ash" : "caller")}>
            <div className="msg-label">{l.agent ? AGENT_NAME : "You"}</div>
            <div className="bubble">{l.text}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---- Voice samples (dummy) ---- */
const SAMPLES = [
  { title: "Greeting", text: "Hi, thanks for calling Acme. How can I help you today?" },
  { title: "Handoff message", text: "Let me connect you with a specialist who can help." },
  { title: "Confirmation", text: "Thanks — I've sent a reset link. Anything else?" },
];
function VoiceSamples({ config, onBack }: { config: AgentConfig; onBack: () => void }) {
  const name = voiceName(config);
  return (
    <>
      <div className="vs-head">
        <button className="icon-btn-back" onClick={onBack} aria-label="Back to call"><Icon name="arrowLeft" size={15} /></button>
        <span className="vs-title">Voice samples</span>
      </div>
      <div className="body">
        <p className="vs-intro">Hear how <b>{name}</b> sounds with the current settings — no call needed.</p>
        {SAMPLES.map((s) => (
          <div key={s.title} className="sample-card">
            <button className="play-btn" aria-label={`Play ${s.title}`}><Icon name="play" size={13} /></button>
            <div className="sample-info">
              <div className="sample-title">{s.title}</div>
              <div className="sample-preview">“{s.text}”</div>
            </div>
            <div className="sample-meta">{name}</div>
          </div>
        ))}
        <div className="custom-input">
          <span className="sparkle"><Icon name="sparkles" size={15} /></span>
          <input type="text" placeholder="Type any line to preview…" />
          <button className="play-btn-small" aria-label="Play custom line"><Icon name="play" size={12} /></button>
        </div>
        <div className="vs-note">Preview is a mockup — coming soon.</div>
      </div>
    </>
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
  const [tab, setTab] = useState<"details" | "transcript">("details");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [lastDuration, setLastDuration] = useState(0);
  const live = !!connectionDetails;
  const setLines = useMemo(() => (l: Line[]) => setTranscript(l), []);
  const handleTick = useMemo(() => (s: number) => setLastDuration(s), []);

  useEffect(() => { if (live) { setTab("transcript"); setShowSamples(false); } }, [live]);
  useEffect(() => { if (endedRoom && !live) setDetailsDirty(true); }, [endedRoom, live]);

  const openDetails = () => { setTab("details"); setDetailsDirty(false); };
  const start = () => { setTranscript([]); setDetailsDirty(false); setShowSamples(false); onStart(); };

  const idleSubtitle = connecting ? "Connecting…" : endedRoom ? `Call ended · ${fmtDur(lastDuration)}` : "Tap to start a test call";

  return (
    <aside className="testpane">
      {/* Header: hidden only on the samples screen when not in a call */}
      {(!showSamples || live) && (
        live ? (
          <LiveKitRoom
            token={connectionDetails!.participantToken}
            serverUrl={connectionDetails!.serverUrl}
            connect={true} audio={true} video={false}
            onDisconnected={onDisconnected}
          >
            <LiveAshCard onLeave={onDisconnected} onTranscript={setLines} onTick={handleTick} />
          </LiveKitRoom>
        ) : (
          <AshCard
            subtitle={idleSubtitle}
            viz={<IdleBars />}
            button={
              <button className="call-btn green" onClick={start} disabled={connecting}
                aria-label={endedRoom ? "Start again" : "Start call"}>
                <Icon name={endedRoom ? "refresh" : "phone"} size={17} />
              </button>
            }
          />
        )
      )}

      {error && <div className="tp-error">{error}</div>}

      {showSamples ? (
        <VoiceSamples config={config} onBack={() => setShowSamples(false)} />
      ) : (
        <>
          <div className="tabs-bar">
            <div className="tabs">
              <button className={"tab" + (tab === "details" ? " active" : "")} onClick={openDetails}>
                Details {detailsDirty && <span className="new" aria-label="New results" />}
              </button>
              <button className={"tab" + (tab === "transcript" ? " active" : "")} onClick={() => setTab("transcript")}>
                Transcript
              </button>
            </div>
            <button className="icon-btn" onClick={() => setShowSamples(true)} aria-label="Voice samples">
              <Icon name="speaker" size={16} />
            </button>
          </div>

          <div className="body">
            {tab === "details" ? <CallDetails config={config} room={endedRoom} /> : <TranscriptBlock lines={transcript} live={live} />}
          </div>

          {endedRoom && !live && tab !== "details" && (
            <div className="foot">
              <button className="btn-secondary" onClick={openDetails}>
                <Icon name="chartBar" size={15} /> View call details <Icon name="arrowRight" size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
