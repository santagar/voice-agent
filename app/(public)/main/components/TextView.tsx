import React, { useMemo } from "react";
import { ArrowUp } from "lucide-react";
import { VoiceMessage } from "@/lib/realtime/useRealtimeSession";
import { TextInput } from "./TextInput";
import { useChatScrolling } from "../hooks/useChatScrolling";
import { computeThinking } from "../utils/computeThinking";
import { ThinkingStatus } from "./ThinkingStatus";
import { MessageList } from "./MessageList";

export type TextViewProps = {
  isDark: boolean;
  t: (key: string) => string;
  chatRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  messages: VoiceMessage[];
  visibleMessages: VoiceMessage[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  assistantTalking: boolean;
  callStatus: "idle" | "calling" | "in_call";
  showAssistantText: boolean;
  shouldShowInput: boolean;
  hasTypedInput: boolean;
  micMuted: boolean;
  showMobileControls: boolean;
  callTimerLabel: string;
  assistantHasConfig: boolean;
  conversationHydrated: boolean;
  conversationLoadError: string | null;
  initialChatId: string | null;
  isNewChatLayout: boolean;
  hydratedFromServer: boolean;
  onSendText: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMobileControls: (show: boolean, force?: boolean) => void;
  onSetShowMobileControls: (show: boolean, force?: boolean) => void;
  onOpenCallControls?: () => void;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
};

export function TextView({
  isDark,
  t,
  chatRef,
  inputRef,
  messages,
  visibleMessages,
  input,
  setInput,
  loading,
  assistantTalking,
  callStatus,
  showAssistantText,
  shouldShowInput,
  hasTypedInput,
  micMuted,
  showMobileControls,
  callTimerLabel,
  assistantHasConfig,
  conversationHydrated,
  conversationLoadError,
  initialChatId,
  isNewChatLayout,
  hydratedFromServer,
  onSendText,
  onStartCall,
  onEndCall,
  onToggleMobileControls,
  onSetShowMobileControls,
  onOpenCallControls,
  onCopy,
  onSpeak,
}: TextViewProps) {
  const { showScrollDown, setShowScrollDown, scrollToBottom, endRef } =
    useChatScrolling({
      chatRef,
      messages,
      visibleMessages,
      hasTypedInput,
      input,
    });
  const showThinking = useMemo(
    () => computeThinking(visibleMessages, loading, assistantTalking),
    [visibleMessages, loading, assistantTalking]
  );
  // Evita mostrar el “thinking” si la llamada está cerrada y no hay carga en curso.
  const showThinkingForChat =
    showThinking && !(callStatus === "idle" && !loading);

  return (
    <>
      <div
        ref={chatRef}
        className="relative flex-1 overflow-y-auto pt-6 pb-4 pr-1"
      >
      {!initialChatId &&
        isNewChatLayout &&
        visibleMessages.length === 0 && (
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-1 pt-48 pb-16 text-center">
            <h1
              className={`text-3xl font-semibold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {t("chat.hero.title")}
            </h1>
            <p
              className={`mt-2 max-w-2xl text-sm ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {t("chat.hero.subtitle")}
            </p>
            {shouldShowInput && (
              <TextInput
                isDark={isDark}
                t={t}
                input={input}
                setInput={setInput}
                inputRef={inputRef}
                assistantHasConfig={assistantHasConfig}
                callStatus={callStatus}
                hasTypedInput={hasTypedInput}
                micMuted={micMuted}
                showMobileControls={showMobileControls}
                callTimerLabel={callTimerLabel}
                onSendText={onSendText}
                onStartCall={onStartCall}
                onEndCall={onEndCall}
                onToggleMobileControls={onSetShowMobileControls}
                onOpenCallControls={() => onOpenCallControls?.()}
                wrapperClassName="mt-6 pb-0"
              />
            )}
          </div>
        )}

      {initialChatId && !conversationHydrated && (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-1 pt-10 pb-4">
          <div
            className={`h-6 w-6 animate-spin rounded-full border-2 border-t-transparent ${
              isDark ? "border-gray-500" : "border-gray-300"
            }`}
          />
        </div>
      )}

      {!initialChatId &&
        conversationHydrated &&
        hydratedFromServer &&
        visibleMessages.length === 0 &&
        messages.length === 0 &&
        !conversationLoadError &&
        !loading && (
          <div className="mx-auto w-full max-w-3xl px-1 pt-10 pb-4 text-sm">
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              {t("chat.emptyConversation")}
            </p>
          </div>
        )}

      <MessageList
        isDark={isDark}
        t={t}
        visibleMessages={visibleMessages}
        showAssistantText={showAssistantText}
        onCopy={onCopy}
        onSpeak={onSpeak}
      />
      {hasTypedInput && <div className="h-48" aria-hidden />}
      <ThinkingStatus show={showThinkingForChat} isDark={isDark} t={t} />
      {showScrollDown && (
        <div className="pointer-events-none sticky bottom-0 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => {
              scrollToBottom();
              setShowScrollDown(false);
            }}
            className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border text-xs shadow-sm transition ${
              isDark
                ? "border-white/15 bg-neutral-900/85 text-white hover:bg-neutral-800"
                : "border-zinc-200 bg-white/95 text-slate-900 hover:bg-zinc-100"
            }`}
            aria-label={t("chat.aria.scrollToBottom")}
          >
            <ArrowUp className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}
        <div ref={endRef} aria-hidden />
      </div>

      {!isNewChatLayout && shouldShowInput && (
        <TextInput
          isDark={isDark}
          t={t}
          input={input}
          setInput={setInput}
          inputRef={inputRef}
          assistantHasConfig={assistantHasConfig}
          callStatus={callStatus}
          hasTypedInput={hasTypedInput}
          micMuted={micMuted}
          showMobileControls={showMobileControls}
          callTimerLabel={callTimerLabel}
          onSendText={onSendText}
          onStartCall={onStartCall}
          onEndCall={onEndCall}
          onToggleMobileControls={onToggleMobileControls}
          onOpenCallControls={() => onOpenCallControls?.()}
        />
      )}
    </>
  );
}
