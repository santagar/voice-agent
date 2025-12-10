import React from "react";
import { ArrowUp, AudioLines, Mic, X } from "lucide-react";
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
  micMuted?: boolean;
  callTimerLabel?: string;
  showInputDuringCall?: boolean;
  showMobileControls?: boolean;
  onSendText: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMobileControls: (show: boolean) => void;
  onOpenCallControls?: () => void;
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
  micMuted = false,
  callTimerLabel,
  showInputDuringCall = false,
  showMobileControls = false,
  onSendText,
  onStartCall,
  onEndCall,
  onToggleMobileControls,
  onOpenCallControls,
  wrapperClassName = "pb-6",
}: TextInputProps) {
  const callActive = callStatus === "calling" || callStatus === "in_call";
  const barsActive = callStatus === "in_call" && !micMuted;
  const inputPadding =
    hasTypedInput || callStatus === "idle"
      ? "pr-16"
      : callStatus === "in_call"
      ? "pr-48"
      : "pr-32";

  return (
    <div
      className={`mx-auto w-full max-w-3xl px-1 sm:px-1 ${wrapperClassName}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className={`h-14 w-full rounded-full border pl-5 ${inputPadding} text-base placeholder:text-neutral-400 focus:outline-none shadow-sm ${
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
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {callActive && (
              <Tooltip
                placement="above"
                offset={12}
                label={
                  showMobileControls
                    ? t("chat.aria.mobileControls.hide")
                    : t("chat.aria.mobileControls.show")
                }
              >
                <button
                  type="button"
                  onClick={() => onOpenCallControls?.()}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                    isDark
                      ? "border-white/10 bg-neutral-800 text-white hover:bg-neutral-700"
                      : "border-zinc-200 bg-white text-slate-900 hover:bg-zinc-100"
                  }`}
                  aria-label={
                    showMobileControls
                      ? t("chat.aria.mobileControls.hide")
                      : t("chat.aria.mobileControls.show")
                  }
                >
                  <Mic className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

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
                className={`flex items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                  hasTypedInput
                    ? isDark
                      ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                      : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                    : callStatus === "in_call"
                    ? "border-rose-400/70 bg-rose-500/90 text-white hover:bg-rose-400 cursor-pointer"
                    : isDark
                    ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                    : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                } ${hasTypedInput ? "h-10 w-10" : callStatus === "in_call" ? "h-10 min-w-[112px] px-3.5" : "h-10 w-10"}`}
                disabled={
                  !assistantHasConfig ||
                  (!hasTypedInput && callStatus === "calling")
                }
              >
                {hasTypedInput ? (
                  <ArrowUp className="h-5 w-5" />
                ) : callStatus === "in_call" ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-4 items-end gap-[3px]" aria-hidden>
                      <span
                        className={`h-[9px] w-[3px] rounded-full bg-white ${barsActive ? "animate-[pulse_1.05s_ease-in-out_infinite]" : ""}`}
                        style={
                          barsActive
                            ? { animationDelay: "0ms" }
                            : { opacity: micMuted ? 0.35 : 0.8 }
                        }
                      />
                      <span
                        className={`h-[13px] w-[3px] rounded-full bg-white ${barsActive ? "animate-[pulse_0.95s_ease-in-out_infinite]" : ""}`}
                        style={
                          barsActive
                            ? { animationDelay: "120ms" }
                            : { opacity: micMuted ? 0.35 : 0.85 }
                        }
                      />
                      <span
                        className={`h-[10px] w-[3px] rounded-full bg-white ${barsActive ? "animate-[pulse_1.15s_ease-in-out_infinite]" : ""}`}
                        style={
                          barsActive
                            ? { animationDelay: "240ms" }
                            : { opacity: micMuted ? 0.35 : 0.75 }
                        }
                      />
                    </div>
                    <span className="font-mono text-sm tabular-nums">
                      {callTimerLabel ?? "00:00"}
                    </span>
                  </div>
                ) : (
                  <AudioLines className="h-5 w-5" />
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
