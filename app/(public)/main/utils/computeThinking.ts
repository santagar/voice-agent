import { VoiceMessage } from "@/lib/realtime/useRealtimeSession";

export function computeThinking(
  visibleMessages: VoiceMessage[],
  loading: boolean,
  assistantTalking: boolean
) {
  let lastAssistant = -1;
  let lastUser = -1;
  visibleMessages.forEach((m, idx) => {
    if (m.from === "assistant" && m.text.trim()) lastAssistant = idx;
    if (m.from === "user") lastUser = idx;
  });
  const pending = lastUser > lastAssistant;
  // Show “thinking” only if the assistant is not yet talking;
  // in voice mode, it disappears as soon as the assistant starts talking.
  return !assistantTalking && (loading || pending);
}
