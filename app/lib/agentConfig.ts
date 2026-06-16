// Shared agent configuration shape. The browser builds this from the form, the
// token route stuffs it into the agent dispatch metadata, and the Python agent
// reads it back to build the session. Keep it JSON-serializable.

export type AgentConfig = {
  // Conversation
  instructions: string;
  welcomeMessage: string;
  allowInterruptions: boolean;

  // Models & Voice
  ttsModel: string;
  ttsVoice: string;
  llmModel: string;
  reasoningEffort: "" | "low" | "medium" | "high"; // "" = provider default
  sttModel: string;
  sttLanguage: string;
  noiseCancellation: string; // "none" | ai_coustics EnhancerModel name
  backgroundAudio: string; // "none" | "office"
};

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
  instructions: DEFAULT_INSTRUCTIONS,
  welcomeMessage: DEFAULT_WELCOME,
  allowInterruptions: true,
  ttsModel: "cartesia/sonic-3",
  ttsVoice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
  llmModel: "openai/gpt-5.2-chat-latest",
  reasoningEffort: "low",
  sttModel: "deepgram/nova-3",
  sttLanguage: "en",
  noiseCancellation: "QUAIL_VF_L",
  backgroundAudio: "none",
};

// Suggestions for the form. Model fields are free-text (any valid LiveKit
// Inference id works) with these as a datalist; the rest are fixed selects.
export const TTS_MODELS = ["cartesia/sonic-3", "cartesia/sonic-2"];
export const TTS_VOICES = [
  { id: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc", label: "Jacqueline (en-US)" },
];
export const LLM_MODELS = [
  "openai/gpt-5.2-chat-latest",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
];
export const REASONING_EFFORTS: AgentConfig["reasoningEffort"][] = [
  "",
  "low",
  "medium",
  "high",
];
export const STT_MODELS = ["deepgram/nova-3", "deepgram/nova-2"];
export const STT_LANGUAGES = ["en", "es", "fr", "de", "hi", "multi"];
export const NOISE_CANCELLATION = [
  { value: "none", label: "None" },
  { value: "QUAIL_VF_L", label: "Quail VF L" },
];
export const BACKGROUND_AUDIO = [
  { value: "none", label: "None" },
  { value: "office", label: "Office ambience" },
];
