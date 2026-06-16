// Shared agent configuration shape. The browser builds this from the form, the
// token route stuffs it into the agent dispatch metadata, and the Python agent
// reads it back to build the session. Keep it JSON-serializable.
//
// The dropdown option lists are derived from livekitOptions.json, which was
// extracted from the LiveKit account's own Agent Builder UI (the source of
// truth for which model/voice/language ids this project actually supports).

import options from "./livekitOptions.json";

export type AgentConfig = {
  // Setup / general (integration + pipeline are presentational for now)
  integration: string;
  pipelineMode: string; // "cascaded" | "realtime" (realtime not yet wired)

  // Conversation
  instructions: string;
  welcomeMessage: string;
  allowInterruptions: boolean;
  minInterruptionDuration: string; // seconds, as string for the dropdown
  minInterruptionWords: string;

  // Models & Voice
  ttsModel: string;
  ttsVoice: string;
  llmModel: string;
  reasoningEffort: string; // "none" | "low" | "medium" | "high" | "xhigh"
  sttModel: string;
  sttLanguage: string;
  noiseCancellation: string;
  backgroundAudio: string;
};

export type Option = { value: string; label: string };
export type ModelGroup = { group: string; options: Option[] };

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  google: "Google Gemini",
  "deepseek-ai": "DeepSeek",
  moonshotai: "Moonshot AI",
  xai: "xAI",
  deepgram: "Deepgram",
  assemblyai: "AssemblyAI",
  cartesia: "Cartesia",
  elevenlabs: "ElevenLabs",
  speechmatics: "Speechmatics",
  inworld: "Inworld",
  rime: "Rime",
};

function prettyProvider(prefix: string): string {
  return PROVIDER_LABELS[prefix] ?? prefix;
}

// Group a flat [{value,label}] list into provider <optgroup>s, preserving the
// order each provider first appears.
function groupByProvider(list: Option[]): ModelGroup[] {
  const groups: ModelGroup[] = [];
  const index = new Map<string, ModelGroup>();
  for (const opt of list) {
    const prefix = opt.value.split("/")[0];
    let group = index.get(prefix);
    if (!group) {
      group = { group: prettyProvider(prefix), options: [] };
      index.set(prefix, group);
      groups.push(group);
    }
    group.options.push(opt);
  }
  return groups;
}

export const TTS_MODELS: ModelGroup[] = groupByProvider(options.tts_models);
export const LLM_MODELS: ModelGroup[] = groupByProvider(options.llm_models);
export const STT_MODELS: ModelGroup[] = groupByProvider(options.stt_models);

export const VOICES_BY_PROVIDER: Record<string, Option[]> =
  options.voices_by_provider;

export const STT_LANGUAGES: Option[] = options.languages;
export const NOISE_CANCELLATION: Option[] = options.noise_cancellation;
export const BACKGROUND_AUDIO: Option[] = options.background_audio;
export const REASONING_EFFORTS: Option[] = options.reasoning_effort;

// Setup: dummy integrations — all currently point at the same settings.
export const INTEGRATIONS: Option[] = [
  { value: "netomi-voice-v1", label: "Netomi Voice Integration v1" },
  { value: "netomi-voice-v2", label: "Netomi Voice Integration v2" },
  { value: "netomi-voice-v3", label: "Netomi Voice Integration v3" },
];

// General: pipeline architecture. Realtime is a placeholder for now.
export const PIPELINE_MODES: Option[] = [
  { value: "cascaded", label: "STT · LLM · TTS integration" },
  { value: "realtime", label: "Realtime integration (coming soon)" },
];

// Barge-in: how aggressively the caller can interrupt the agent.
export const INTERRUPTION_DURATIONS: Option[] = [
  { value: "0.3", label: "0.3s — fast (fewer dropped words)" },
  { value: "0.5", label: "0.5s — default" },
  { value: "0.8", label: "0.8s — relaxed" },
  { value: "1.0", label: "1.0s — very relaxed" },
];
export const INTERRUPTION_WORDS: Option[] = [
  { value: "0", label: "Any sound (0 words)" },
  { value: "1", label: "1 word" },
  { value: "2", label: "2 words" },
  { value: "3", label: "3 words" },
];

export const DEFAULT_INSTRUCTIONS = `You are a helpful, concise customer support voice agent for {Company}. Your job is to understand the customer's issue, gather the minimum necessary context, and either resolve the issue clearly or guide the customer to the right next step.

Goals:
- Understand what the customer is trying to do.
- Identify what went wrong or what information is missing.
- Resolve simple issues directly when possible.
- Escalate cleanly when the issue requires a human or a backend action.

Rules:
- Be calm, direct, and empathetic.
- Start by confirming the customer's goal in one sentence.
- Ask one or two focused questions at a time.
- Prefer concrete next steps over generic reassurance.
- Do not invent account details, order details, or policies.
- If the customer is frustrated, acknowledge that and stay practical.
- If you cannot complete the request, explain what the next best action is.

Conversation outline:
1. Understand the issue.
2. Gather key context.
3. Offer troubleshooting or status guidance.
4. Confirm whether the issue is resolved.
5. Summarize the next step if not resolved.`;

export const DEFAULT_WELCOME =
  "Hi, thanks for calling {Company} support. I can help with questions, troubleshooting, or account issues. What are you trying to do today?";

export const defaultAgentConfig: AgentConfig = {
  integration: "netomi-voice-v1",
  pipelineMode: "cascaded",
  instructions: DEFAULT_INSTRUCTIONS,
  welcomeMessage: DEFAULT_WELCOME,
  allowInterruptions: true,
  minInterruptionDuration: "0.5",
  minInterruptionWords: "0",
  ttsModel: "cartesia/sonic-3",
  ttsVoice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
  llmModel: "openai/gpt-5.2-chat-latest",
  reasoningEffort: "low",
  sttModel: "deepgram/nova-3",
  sttLanguage: "en",
  noiseCancellation: "quail-vf-l",
  backgroundAudio: "none",
};
