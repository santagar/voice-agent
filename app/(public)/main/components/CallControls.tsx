import { Mic, MicOff, Volume2, VolumeX, AudioLines, X, MessageCircle, MessageCircleOff, TextCursorInput } from "lucide-react";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { CallStatus } from "@/lib/realtime/useRealtimeSession";

type CallControlsProps = {
  isDark: boolean;
  t: (key: string, fallback?: string) => string;
  callStatus: CallStatus;
  micMuted: boolean;
  muted: boolean;
  showAssistantText: boolean;
  showInputDuringCall: boolean;
  onToggleAssistantText: () => void;
  onToggleInputDuringCall: () => void;
  onSetInputDuringCall: (show: boolean) => void;
  onToggleSpeaker: () => void;
  onToggleMic: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onResetAfterEnd: () => void;
  onChangeMobileControls: (show: boolean) => void;
};

export function CallControls({
  isDark,
  t,
  callStatus,
  micMuted,
  muted,
  showAssistantText,
  showInputDuringCall,
  onToggleAssistantText,
  onToggleInputDuringCall,
  onSetInputDuringCall,
  onToggleSpeaker,
  onToggleMic,
  onStartCall,
  onEndCall,
  onResetAfterEnd,
  onChangeMobileControls,
}: CallControlsProps) {
  const isInCall = callStatus === "in_call";
  const isCalling = callStatus === "calling";

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAssistantText}
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
            !showAssistantText
              ? "border-transparent bg-rose-100 text-rose-700"
              : isDark
              ? "border-white/20 bg-neutral-800 text-white"
              : "border-zinc-300 bg-zinc-800 text-white"
          }`}
        >
          <Tooltip
            label={
              showAssistantText
                ? t("chat.tooltip.hideChatText")
                : t("chat.tooltip.showChatText")
            }
          >
            <span>
              {showAssistantText ? (
                <MessageCircle className="h-4 w-4" />
              ) : (
                <MessageCircleOff className="h-4 w-4" />
              )}
            </span>
          </Tooltip>
        </button>
        <button
          onClick={onToggleSpeaker}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
            muted
              ? "border-transparent bg-rose-100 text-rose-700"
              : isDark
              ? "border-white/20 bg-neutral-800 text-white"
              : "border-zinc-300 bg-zinc-800 text-white"
          }`}
        >
          <Tooltip
            label={
              muted
                ? t("chat.tooltip.unmuteSpeaker")
                : t("chat.tooltip.muteSpeaker")
            }
          >
            <span>
              {muted ? (
                <VolumeX strokeWidth={1.8} className="h-5 w-5 text-rose-700" />
              ) : (
                <Volume2 strokeWidth={1.8} className="h-5 w-5 text-white" />
              )}
            </span>
          </Tooltip>
        </button>
        <button
          onClick={() => {
            if (isInCall) {
              onEndCall();
              onChangeMobileControls(false);
              onSetInputDuringCall(false);
              onResetAfterEnd();
            } else if (!isCalling) {
              onStartCall();
              onChangeMobileControls(true);
            }
          }}
          className={`flex h-16 w-16 items-center justify-center rounded-full border text-white transition active:scale-95 ${
            isInCall
              ? "border-rose-500/50 bg-rose-500"
              : isCalling
              ? "border-amber-400/60 bg-amber-500 animate-pulse"
              : "border-emerald-400/60 bg-emerald-500"
          }`}
        >
          <Tooltip
            label={
              isInCall ? t("chat.tooltip.endCall") : t("chat.tooltip.startCall")
            }
          >
            <span>
              {isInCall ? <X className="h-8 w-8" /> : <AudioLines className="h-7 w-7" />}
            </span>
          </Tooltip>
        </button>
        <button
          onClick={onToggleMic}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
            micMuted
              ? "border-transparent bg-rose-100 text-rose-700"
              : isDark
              ? "border-white/20 bg-neutral-800 text-white"
              : "border-zinc-300 bg-zinc-800 text-white"
          }`}
        >
          <Tooltip
            label={
              micMuted
                ? t("chat.tooltip.unmuteMic")
                : t("chat.tooltip.muteMic")
            }
          >
            <span>
              {micMuted ? (
                <MicOff strokeWidth={1.8} className="h-5 w-5 text-rose-700" />
              ) : (
                <Mic strokeWidth={1.8} className="h-5 w-5 text-white" />
              )}
            </span>
          </Tooltip>
        </button>
        <button
          onClick={onToggleInputDuringCall}
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
            !showInputDuringCall
              ? "border-transparent bg-rose-100 text-rose-700"
              : isDark
              ? "border-white/20 bg-neutral-800 text-white"
              : "border-zinc-300 bg-zinc-800 text-white"
          }`}
        >
          <Tooltip
            label={
              showInputDuringCall
                ? t("chat.tooltip.hideTextInput")
                : t("chat.tooltip.showTextInput")
            }
          >
            <span>
              <TextCursorInput className="h-4 w-4" />
            </span>
          </Tooltip>
        </button>
      </div>
    </div>
  );
}
