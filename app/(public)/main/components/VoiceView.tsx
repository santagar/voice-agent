import React, { useMemo } from "react";
import { ArrowUp } from "lucide-react";
import { TextViewProps } from "./TextView";
import { TextInput } from "./TextInput";
import { CallControls } from "./CallControls";
import { useChatScrolling } from "../hooks/useChatScrolling";
import { computeThinking } from "../utils/computeThinking";
import { ThinkingStatus } from "./ThinkingStatus";
import { MessageList } from "./MessageList";

type VoiceViewProps = TextViewProps & {
  micMuted: boolean;
  muted: boolean;
  showInputDuringCall: boolean;
  showMobileControls: boolean;
  callActive: boolean;
  callTimerLabel: string;
  onToggleAssistantText: () => void;
  onToggleInputDuringCall: () => void;
  onSetInputDuringCall: (show: boolean) => void;
  onToggleSpeaker: () => void;
  onToggleMic: () => void;
  onEndCall: () => void;
  onResetAfterEnd: () => void;
};

export function VoiceView({
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
  onCopy,
  onSpeak,
  micMuted,
  muted,
  showInputDuringCall,
  showMobileControls,
  callTimerLabel,
  callActive,
  onToggleAssistantText,
  onToggleInputDuringCall,
  onSetInputDuringCall,
  onToggleSpeaker,
  onToggleMic,
  onResetAfterEnd,
}: VoiceViewProps) {
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
  const showThinkingForVoice = showThinking && callStatus !== "idle";

  return (
    <>
      {callActive && (
        <div className="pointer-events-none fixed inset-x-0 top-2 z-30 flex justify-center md:hidden">
          <div
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.16em] ${
              isDark
                ? "bg-white/10 text-gray-100"
                : "bg-zinc-900 text-zinc-100"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs">{callTimerLabel}</span>
          </div>
        </div>
      )}

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
                onSendText={onSendText}
                onStartCall={onStartCall}
                onEndCall={onEndCall}
                onToggleMobileControls={onSetShowMobileControls}
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

      {initialChatId &&
        conversationHydrated &&
        hydratedFromServer &&
        visibleMessages.length === 0 &&
        !conversationLoadError && (
          <div className="mx-auto w-full max-w-3xl px-1 pt-10 pb-4 text-sm">
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              {t("chat.emptyConversation")}
            </p>
          </div>
        )}

      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <MessageList
          isDark={isDark}
          t={t}
          visibleMessages={visibleMessages}
          showAssistantText={showAssistantText}
          onCopy={onCopy}
          onSpeak={onSpeak}
        />
      </div>
      <ThinkingStatus show={showThinkingForVoice} isDark={isDark} t={t} />
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
          onSendText={onSendText}
          onStartCall={onStartCall}
          onEndCall={onEndCall}
          onToggleMobileControls={onToggleMobileControls}
        />
      )}

      {showMobileControls && (
        <div className="mt-4">
          <div className="mx-auto flex w-full max-w-md items-center justify-center gap-4 px-2">
            <CallControls
              isDark={isDark}
              t={t}
              callStatus={callStatus}
              micMuted={micMuted}
              muted={muted}
              showAssistantText={showAssistantText}
              showInputDuringCall={showInputDuringCall}
              onToggleAssistantText={onToggleAssistantText}
              onToggleInputDuringCall={onToggleInputDuringCall}
              onSetInputDuringCall={onSetInputDuringCall}
              onToggleSpeaker={onToggleSpeaker}
              onToggleMic={onToggleMic}
              onStartCall={onStartCall}
              onEndCall={onEndCall}
              onResetAfterEnd={onResetAfterEnd}
              onChangeMobileControls={onSetShowMobileControls}
            />
          </div>
        </div>
      )}
    </>
  );
}
