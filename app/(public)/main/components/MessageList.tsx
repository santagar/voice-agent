"use client";

import { Copy, Mic, Volume2 } from "lucide-react";
import { VoiceMessage } from "@/lib/realtime/useRealtimeSession";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { IconButton } from "@/components/front/ui/IconButton";
import { MarkdownMessage } from "@/components/front/ui/MarkdownMessage";
import { ChatBubble } from "@/components/front/ui/ChatBubble";

type MessageListProps = {
  isDark: boolean;
  t: (key: string) => string;
  visibleMessages: VoiceMessage[];
  showAssistantText: boolean;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
};

export function MessageList({
  isDark,
  t,
  visibleMessages,
  showAssistantText,
  onCopy,
  onSpeak,
}: MessageListProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 items-stretch">
      {visibleMessages.map((message) => {
        const isAssistant = message.from === "assistant";
        const isUser = message.from === "user";
        const showActions = isAssistant;

        // If text is hidden, only hide assistant bubbles; keep user
        // transcripts visible so the conversation context is clear.
        if (!showAssistantText && isAssistant) {
          return null;
        }

        if (isAssistant) {
          return (
            <div key={message.id} className="space-y-2 px-1 text-left w-full">
              <MarkdownMessage text={message.text} />
              {showActions && (
                <div className="flex items-center gap-1">
                  <IconButton
                    size="sm"
                    isDark={isDark}
                    variant="ghost"
                    className="rounded-lg"
                    onClick={() => void onCopy(message.text)}
                  >
                    <Tooltip label={t("chat.tooltip.copy")}>
                      <span>
                        <Copy className="h-5 w-5" />
                      </span>
                    </Tooltip>
                  </IconButton>
                  <IconButton
                    size="sm"
                    isDark={isDark}
                    variant="ghost"
                    className="rounded-lg"
                    onClick={() => void onSpeak(message.text)}
                  >
                    <Tooltip label={t("chat.tooltip.playAudio")}>
                      <span>
                        <Volume2 className="h-5 w-5" />
                      </span>
                    </Tooltip>
                  </IconButton>
                </div>
              )}
            </div>
          );
        }

        const isPendingUserUtterance = isUser && message.text === "…";
        if (isPendingUserUtterance) {
          return (
            <div
              key={message.id}
              className="flex justify-end px-1"
              aria-label="User is speaking"
            >
              <span className="h-3 w-3 animate-pulse rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
            </div>
          );
        }

        if (isUser) {
          const metaRaw = message.meta;
          const metaObj =
            typeof metaRaw === "object" && metaRaw !== null
              ? (metaRaw as {
                  turnType?: string;
                  turn_type?: string;
                  type?: string;
                  inputMode?: string;
                  outputMode?: string;
                  mode?: string;
                })
              : null;
          const metaTurnType =
            metaObj?.turnType || metaObj?.turn_type || metaObj?.type;
          const metaToken =
            typeof metaTurnType === "string"
              ? metaTurnType.toLowerCase()
              : typeof metaRaw === "string"
              ? metaRaw.toLowerCase()
              : "";
          const metaInput =
            typeof metaObj?.inputMode === "string"
              ? metaObj.inputMode.toLowerCase()
              : "";
          const metaOutput =
            typeof metaObj?.outputMode === "string"
              ? metaObj.outputMode.toLowerCase()
              : "";
          const metaMode =
            typeof metaObj?.mode === "string"
              ? metaObj.mode.toLowerCase()
              : "";
          const isVoiceTranscript =
            metaToken === "user_voice" ||
            metaToken === "assistant_voice" ||
            metaToken === "voice" ||
            metaInput === "microphone" ||
            metaOutput === "voice" ||
            metaMode === "voice" ||
            metaToken.includes("voice");

          const metaLabel =
            isVoiceTranscript ? (
              <span className="inline-flex items-center gap-1">
                <Mic className="h-4 w-4" />
                <span>voice</span>
              </span>
            ) : typeof message.meta === "string"
            ? message.meta
            : null;

          return (
            <div key={message.id} className="group px-1 w-full">
              <ChatBubble
                from={message.from}
                meta={metaLabel}
                variant="chat"
                className="rounded-[24px] w-fit ml-auto"
              >
                {isVoiceTranscript ? (
                  <em>&quot;{message.text}&quot;</em>
                ) : (
                  message.text
                )}
              </ChatBubble>
              <div className="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <IconButton
                  size="sm"
                  isDark={isDark}
                  variant="ghost"
                  className="rounded-lg"
                  onClick={() => void onCopy(message.text)}
                >
                  <Tooltip label={t("chat.tooltip.copy")}>
                    <span>
                      <Copy className="h-5 w-5" />
                    </span>
                  </Tooltip>
                </IconButton>
              </div>
            </div>
          );
        }

        return (
          <div key={message.id} className="px-1">
            <ChatBubble
              from={message.from}
              meta={typeof message.meta === "string" ? message.meta : null}
              className="rounded-[24px]"
            >
              {message.text}
            </ChatBubble>
          </div>
        );
      })}
    </div>
  );
}
