import {
  type AgentConfig,
  type Option,
  type ModelGroup,
  LLM_MODELS,
  STT_MODELS,
  TTS_MODELS,
  STT_LANGUAGES,
  NOISE_CANCELLATION,
  BACKGROUND_AUDIO,
  REASONING_EFFORTS,
  INTEGRATIONS,
  PIPELINE_MODES,
  INTERRUPTION_DURATIONS,
  INTERRUPTION_WORDS,
} from "./agentConfig";

export type FieldKind = "textarea" | "toggle" | "select" | "modelselect" | "voice" | "subhead";

export type Field = {
  key?: keyof AgentConfig;
  label: string;
  help?: string;
  kind: FieldKind;
  wide?: boolean;
  rows?: number;
  options?: Option[];
  groups?: ModelGroup[];
};

export type Section = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  fields: Field[];
};

export type Group = { group: string; items: Section[] };

export const SECTION_GROUPS: Group[] = [
  {
    group: "Setup",
    items: [
      {
        id: "integration",
        title: "Integration",
        desc: "Select the voice integration to configure.",
        icon: "integration",
        fields: [
          { key: "integration", label: "Integration", kind: "select", options: INTEGRATIONS,
            help: "All versions currently point to the same settings." },
        ],
      },
    ],
  },
  {
    group: "General",
    items: [
      {
        id: "general",
        title: "General",
        desc: "Choose how the agent processes a conversation.",
        icon: "list",
        fields: [
          { key: "pipelineMode", label: "Architecture", kind: "select", options: PIPELINE_MODES,
            help: "Realtime is a placeholder — the agent currently runs the STT · LLM · TTS pipeline." },
        ],
      },
    ],
  },
  {
    group: "Voice & Model",
    items: [
      {
        id: "model",
        title: "Model",
        desc: "Pick the speech, language, and voice models for the pipeline.",
        icon: "gauge",
        fields: [
          { label: "Speech-to-text", kind: "subhead" },
          { key: "sttModel", label: "Model", kind: "modelselect", groups: STT_MODELS },
          { key: "sttLanguage", label: "Language", kind: "select", options: STT_LANGUAGES },
          { label: "Language model", kind: "subhead" },
          { key: "llmModel", label: "Model", kind: "modelselect", groups: LLM_MODELS },
          { key: "reasoningEffort", label: "Reasoning effort", kind: "select", options: REASONING_EFFORTS,
            help: "Higher effort is slower; not all models support it." },
          { label: "Text-to-speech", kind: "subhead" },
          { key: "ttsModel", label: "Model", kind: "modelselect", groups: TTS_MODELS },
          { key: "ttsVoice", label: "Voice", kind: "voice", help: "Voices depend on the selected provider." },
        ],
      },
      {
        id: "systemPrompt",
        title: "System prompt",
        desc: "Instructions that shape the agent's personality and behavior.",
        icon: "doc",
        fields: [
          { key: "instructions", label: "Instructions", kind: "textarea", wide: true, rows: 16 },
        ],
      },
    ],
  },
  {
    group: "Conversation",
    items: [
      {
        id: "welcome",
        title: "Welcome message",
        desc: "Spoken verbatim when the call connects.",
        icon: "chat",
        fields: [
          { key: "welcomeMessage", label: "Welcome message", kind: "textarea", wide: true, rows: 4 },
        ],
      },
      {
        id: "bargein",
        title: "Barge-in",
        desc: "Control whether and how the caller can interrupt the agent while it's speaking.",
        icon: "hand",
        fields: [
          { key: "allowInterruptions", label: "Allow interruptions", kind: "toggle",
            help: "When on, the caller can talk over the greeting and responses." },
          { key: "minInterruptionDuration", label: "Min interruption duration", kind: "select",
            options: INTERRUPTION_DURATIONS,
            help: "How long the caller must speak before the agent yields. Lower = fewer dropped words when barging in, but more false triggers." },
          { key: "minInterruptionWords", label: "Min interruption words", kind: "select",
            options: INTERRUPTION_WORDS,
            help: "Require this many recognized words before treating speech as an interruption." },
        ],
      },
    ],
  },
  {
    group: "Audio",
    items: [
      {
        id: "audio",
        title: "Audio enhancements",
        desc: "Clean up the caller's audio and optionally add ambience.",
        icon: "wave",
        fields: [
          { key: "noiseCancellation", label: "Noise cancellation", kind: "select", options: NOISE_CANCELLATION },
          { key: "backgroundAudio", label: "Background audio", kind: "select", options: BACKGROUND_AUDIO },
        ],
      },
    ],
  },
];
