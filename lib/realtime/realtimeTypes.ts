export type VoiceMessage = {
  id: string;
  from: "user" | "assistant" | "system";
  text: string;
  meta?: Record<string, unknown> | string | null;
};

export type CallStatus = "idle" | "calling" | "in_call";

export type ScopeDefinition = {
  name: string;
  keywords: string[];
};

export type VoiceSessionStore = {
  messages: VoiceMessage[];
  input: string;
  loading: boolean;
  wsConnected: boolean;
  callStatus: CallStatus;
  inCall: boolean;
  assistantTalking: boolean;
  isRecording: boolean;
  muted: boolean;
  micMuted: boolean;
  currentScope: string;
  scopes: ScopeDefinition[];
  sessionActive: boolean;
  canStartCall: boolean;
  sendDisabled: boolean;
};

export type VoiceSessionActions = {
  setInput: (value: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
  startCall: () => void;
  endCall: () => void;
  toggleSpeaker: () => void;
  toggleMic: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  sendUserMessage: (
    text: string,
    options?: {
      silent?: boolean;
      conversationId?: string | null;
      assistantId?: string | null;
      meta?: Record<string, unknown>;
    }
  ) => Promise<void>;
};
