import React from "react";
import { ArrowUp, AudioLines, X } from "lucide-react";
import { Tooltip } from "@/components/front/ui/Tooltip";

type TextInputProps = {
  isDark: boolean;
  t: (key: string) => string;
  input: string;
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  assistantHasConfig: boolean;
  callStatus: "idle" | "calling" | "in_call";
  hasTypedInput: boolean;
  onSendText: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMobileControls: (show: boolean) => void;
  wrapperClassName?: string;
};

export function TextInput({
  isDark,
  t,
  input,
  setInput,
  inputRef,
  assistantHasConfig,
  callStatus,
  hasTypedInput,
  onSendText,
  onStartCall,
  onEndCall,
  onToggleMobileControls,
  wrapperClassName = "pb-6",
}: TextInputProps) {
  return (
    <div
      className={`mx-auto w-full max-w-3xl px-1 sm:px-1 ${wrapperClassName}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className={`h-14 w-full rounded-full border pl-5 pr-16 text-base placeholder:text-neutral-400 focus:outline-none shadow-sm ${
              isDark
                ? "border-white/10 bg-white/5 text-slate-100 shadow-black/30"
                : "border-zinc-300 bg-white/80 text-slate-900 shadow-black/10"
            }`}
            placeholder={
              !assistantHasConfig
                ? t("chat.input.placeholderConfigureAssistant")
                : callStatus === "in_call"
                ? t("chat.input.placeholderInCall")
                : t("chat.input.placeholderIdle")
            }
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setInput(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!assistantHasConfig) return;
                if (input.trim()) {
                  onSendText();
                }
              }
            }}
            disabled={!assistantHasConfig}
          />
          <Tooltip
            placement="above"
            offset={12}
            align="end"
            label={
              hasTypedInput
                ? t("chat.tooltip.send")
                : callStatus === "in_call"
                ? t("chat.tooltip.endCall")
                : t("chat.tooltip.startVoiceCall")
            }
          >
            <button
              onClick={() => {
                if (!assistantHasConfig) return;
                if (hasTypedInput) {
                  onSendText();
                } else {
                  if (callStatus === "calling") return;
                  if (callStatus === "in_call") {
                    onEndCall();
                    onToggleMobileControls(false);
                  } else {
                    onStartCall();
                    onToggleMobileControls(true);
                  }
                }
              }}
              className={`absolute right-2 top-1/2 -mt-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                hasTypedInput
                  ? isDark
                    ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                    : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                  : callStatus === "in_call"
                  ? "border-rose-400/70 bg-rose-500/90 text-white hover:bg-rose-400 cursor-pointer"
                  : isDark
                  ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                  : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
              }`}
              disabled={
                !assistantHasConfig ||
                (!hasTypedInput && callStatus === "calling")
              }
            >
              {hasTypedInput ? (
                <ArrowUp className="h-5 w-5" />
              ) : callStatus === "in_call" ? (
                <X className="h-5 w-5" />
              ) : (
                <AudioLines className="h-5 w-5" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
