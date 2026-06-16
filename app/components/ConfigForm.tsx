"use client";

import { useState } from "react";
import {
  type AgentConfig,
  TTS_MODELS,
  TTS_VOICES,
  LLM_MODELS,
  REASONING_EFFORTS,
  STT_MODELS,
  STT_LANGUAGES,
  NOISE_CANCELLATION,
  BACKGROUND_AUDIO,
} from "../lib/agentConfig";

type Tab = "conversation" | "models";

export function ConfigForm({
  config,
  onChange,
  onStart,
  connecting,
}: {
  config: AgentConfig;
  onChange: (next: AgentConfig) => void;
  onStart: () => void;
  connecting: boolean;
}) {
  const [tab, setTab] = useState<Tab>("conversation");
  const set = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <div className="config">
      <div className="tabs">
        <button
          className={tab === "conversation" ? "tab active" : "tab"}
          onClick={() => setTab("conversation")}
        >
          Conversation
        </button>
        <button
          className={tab === "models" ? "tab active" : "tab"}
          onClick={() => setTab("models")}
        >
          Models &amp; Voice
        </button>
      </div>

      {tab === "conversation" && (
        <div className="fields">
          <label className="field">
            <span className="field-label">Instructions</span>
            <textarea
              className="textarea"
              rows={10}
              value={config.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Welcome message</span>
            <textarea
              className="textarea"
              rows={3}
              value={config.welcomeMessage}
              onChange={(e) => set("welcomeMessage", e.target.value)}
            />
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={config.allowInterruptions}
              onChange={(e) => set("allowInterruptions", e.target.checked)}
            />
            Allow users to interrupt the greeting
          </label>
        </div>
      )}

      {tab === "models" && (
        <div className="fields">
          <div className="pipeline-note">
            Pipeline mode: <strong>STT → LLM → TTS</strong>. (Realtime model is
            not wired up in this demo.)
          </div>

          <div className="row">
            <label className="field">
              <span className="field-label">TTS model</span>
              <input
                className="input"
                list="tts-models"
                value={config.ttsModel}
                onChange={(e) => set("ttsModel", e.target.value)}
              />
              <datalist id="tts-models">
                {TTS_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span className="field-label">Voice ID</span>
              <input
                className="input"
                list="tts-voices"
                value={config.ttsVoice}
                onChange={(e) => set("ttsVoice", e.target.value)}
              />
              <datalist id="tts-voices">
                {TTS_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </datalist>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span className="field-label">LLM model</span>
              <input
                className="input"
                list="llm-models"
                value={config.llmModel}
                onChange={(e) => set("llmModel", e.target.value)}
              />
              <datalist id="llm-models">
                {LLM_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span className="field-label">Reasoning effort</span>
              <select
                className="input"
                value={config.reasoningEffort}
                onChange={(e) =>
                  set(
                    "reasoningEffort",
                    e.target.value as AgentConfig["reasoningEffort"],
                  )
                }
              >
                {REASONING_EFFORTS.map((r) => (
                  <option key={r || "default"} value={r}>
                    {r === "" ? "Provider default" : r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span className="field-label">STT model</span>
              <input
                className="input"
                list="stt-models"
                value={config.sttModel}
                onChange={(e) => set("sttModel", e.target.value)}
              />
              <datalist id="stt-models">
                {STT_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span className="field-label">Language</span>
              <select
                className="input"
                value={config.sttLanguage}
                onChange={(e) => set("sttLanguage", e.target.value)}
              >
                {STT_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span className="field-label">Noise cancellation</span>
              <select
                className="input"
                value={config.noiseCancellation}
                onChange={(e) => set("noiseCancellation", e.target.value)}
              >
                {NOISE_CANCELLATION.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Background audio</span>
              <select
                className="input"
                value={config.backgroundAudio}
                onChange={(e) => set("backgroundAudio", e.target.value)}
              >
                {BACKGROUND_AUDIO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <button className="start-button" onClick={onStart} disabled={connecting}>
        {connecting ? "Connecting…" : "Start call"}
      </button>
    </div>
  );
}
