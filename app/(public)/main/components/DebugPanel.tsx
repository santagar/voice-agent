import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { VoiceMessage } from "@/lib/realtime/useRealtimeSession";
import { AssistantConfig } from "../../a/editor/components/AssistantSettingsPanel";
import { useApiConfig } from "@/hooks/useApiConfig";

type DebugConfig = {
  instructions?: unknown;
  tools?: unknown;
  sanitize?: unknown;
};

type DebugPanelProps = {
  isDark: boolean;
  t: (key: string) => string;
  wsConnected: boolean;
  callStatus: "idle" | "calling" | "in_call";
  micMuted: boolean;
  muted: boolean;
  assistantTalking: boolean;
  currentScope: string;
  configExpanded: boolean;
  setConfigExpanded: (next: boolean | ((prev: boolean) => boolean)) => void;
  eventsExpanded: boolean;
  setEventsExpanded: (next: boolean | ((prev: boolean) => boolean)) => void;
  debugEvents: VoiceMessage[];
  onClose: () => void;
  assistantConfig: AssistantConfig | null;
  assistantConfigLoading: boolean;
  assistantConfigError: string | null;
  sessionId: string | null;
  activeConversationId: string | null;
  assistantId: string | null;
  bridgeConnections: number | null;
};

export function DebugPanel({
  isDark,
  t,
  wsConnected,
  callStatus,
  micMuted,
  muted,
  assistantTalking,
  currentScope,
  configExpanded,
  setConfigExpanded,
  eventsExpanded,
  setEventsExpanded,
  debugEvents,
  onClose,
  assistantConfig,
  assistantConfigLoading,
  assistantConfigError,
  sessionId,
  activeConversationId,
  assistantId,
  bridgeConnections,
}: DebugPanelProps) {
  const { fetchInstructions, fetchTools, fetchSanitize } = useApiConfig();
  const [debugConfig, setDebugConfig] = useState<DebugConfig | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [debugOffset, setDebugOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [debugSize, setDebugSize] = useState<{ width: number; height: number }>(
    { width: 320, height: 260 }
  );
  const debugDraggingRef = useRef(false);
  const debugDragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const debugOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const debugResizingRef = useRef(false);
  const debugResizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    width: number;
    height: number;
  } | null>(null);
  const debugSizeRef = useRef<{ width: number; height: number }>({
    width: 320,
    height: 260,
  });

  useEffect(() => {
    if (debugConfig || debugLoading) return;
    let cancelled = false;
    setDebugLoading(true);
    setDebugError(null);

    async function loadDebugConfig() {
      try {
        const [profileJson, toolsJson, sanitizeJson] = await Promise.all([
          fetchInstructions(),
          fetchTools(),
          fetchSanitize(),
        ]);
        if (cancelled) return;
        setDebugConfig({
          instructions: profileJson.instructions,
          tools: toolsJson.tools,
          sanitize: sanitizeJson.sanitize,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: unknown }).message)
            : "Unknown error loading debug config";
        setDebugError(message);
      } finally {
        if (!cancelled) {
          setDebugLoading(false);
        }
      }
    }

    void loadDebugConfig();

    return () => {
      cancelled = true;
    };
  }, [debugConfig, debugLoading]);

  useEffect(() => {
    debugOffsetRef.current = debugOffset;
  }, [debugOffset]);

  useEffect(() => {
    debugSizeRef.current = debugSize;
  }, [debugSize]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (debugDraggingRef.current && debugDragStartRef.current) {
        const { mouseX, mouseY, offsetX, offsetY } = debugDragStartRef.current;
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;
        const next = { x: offsetX + dx, y: offsetY + dy };
        debugOffsetRef.current = next;
        setDebugOffset(next);
      } else if (debugResizingRef.current && debugResizeStartRef.current) {
        const { mouseX, mouseY, width, height } = debugResizeStartRef.current;
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;
        const nextWidth = Math.max(320, width + dx);
        const nextHeight = Math.max(260, height + dy);
        const nextSize = { width: nextWidth, height: nextHeight };
        debugSizeRef.current = nextSize;
        setDebugSize(nextSize);
      }
    }

    function handleMouseUp() {
      debugDraggingRef.current = false;
      debugDragStartRef.current = null;
      debugResizingRef.current = false;
      debugResizeStartRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function handleDebugDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const current = debugOffsetRef.current;
    debugDraggingRef.current = true;
    debugDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: current.x,
      offsetY: current.y,
    };
  }

  function handleDebugResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const current = debugSizeRef.current;
    debugResizingRef.current = true;
    debugResizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: current.width,
      height: current.height,
    };
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
      <div
        className={`pointer-events-auto m-4 rounded-2xl border px-4 py-3 text-xs shadow-lg flex flex-col overflow-hidden relative ${
          isDark
            ? "border-sky-500/40 bg-neutral-800/95 text-sky-100"
            : "border-zinc-300 bg-white text-slate-900"
        }`}
        style={{
          transform: `translate(${debugOffset.x}px, ${debugOffset.y}px)`,
          width: `${debugSize.width}px`,
          height: `${debugSize.height}px`,
          maxWidth: "min(520px, 100% - 32px)",
          maxHeight: "min(560px, 100% - 32px)",
        }}
      >
        <div className="mb-2 cursor-move pr-6" onMouseDown={handleDebugDragStart}>
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold ${
                isDark ? "text-sky-300" : "text-sky-700"
              }`}
            >
              Debug panel
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Pill isDark={isDark} label={`WS: ${wsConnected ? "connected" : "disconnected"}`} />
            <Pill isDark={isDark} label={`Call: ${callStatus}`} />
            <Pill isDark={isDark} label={`Mic: ${micMuted ? "muted" : "open"}`} />
            <Pill isDark={isDark} label={`Speaker: ${muted ? "muted" : "on"}`} />
            <Pill isDark={isDark} label={`Assistant: ${assistantTalking ? "speaking" : "idle"}`} />
            <Pill isDark={isDark} label={`Scope: ${currentScope || "n/a"}`} />
            <Pill isDark={isDark} label={`Session: ${sessionId ?? "n/a"}`} />
            <Pill isDark={isDark} label={`Conv: ${activeConversationId ?? "n/a"}`} />
            <Pill isDark={isDark} label={`Asst: ${assistantId ?? "n/a"}`} />
            <Pill
              isDark={isDark}
              label={`Bridge WS: ${
                bridgeConnections !== null ? bridgeConnections : "n/a"
              }`}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${
            isDark
              ? "bg-neutral-800 text-slate-300 hover:bg-neutral-700"
              : "bg-zinc-200 text-slate-700 hover:bg-zinc-300"
          }`}
          aria-label="Close debug panel"
        >
          <X className="h-3 w-3" />
        </button>

        <div
          className={`mt-1 flex-1 min-h-0 overflow-y-auto border-t pt-2 ${
            isDark ? "border-white/10" : "border-zinc-200"
          }`}
        >
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setConfigExpanded((prev) => !prev)}
              className={`flex w-full items-center justify-between text-[11px] font-semibold ${
                isDark ? "text-sky-300" : "text-sky-700"
              }`}
            >
              <span>{t("chat.debug.config.title")}</span>
              <span className="text-[10px] text-slate-400">
                {configExpanded
                  ? t("chat.debug.config.collapse")
                  : t("chat.debug.config.expand")}
              </span>
            </button>
            {configExpanded && (
              <div className="mt-1">
                {debugLoading && (
                  <p className="text-slate-400">Loading debug config…</p>
                )}
                {debugError && (
                  <p className="text-rose-400">
                    Error loading config: {debugError}
                  </p>
                )}
                {!debugLoading && !debugError && debugConfig && (
                  <div className="space-y-1">
                    <DebugLine
                      isDark={isDark}
                      label="Instruction blocks:"
                      value={
                        Object.keys(debugConfig.instructions ?? {}).join(", ") ||
                        "none"
                      }
                    />
                    <DebugLine
                      isDark={isDark}
                      label="Tools:"
                      value={
                        Array.isArray(debugConfig.tools) &&
                        debugConfig.tools.length > 0
                          ? (debugConfig.tools as { name?: string }[])
                              .map((t) => t.name)
                              .filter(Boolean)
                              .join(", ")
                          : "none"
                      }
                    />
                    <DebugLine
                      isDark={isDark}
                      label="Sanitize rules:"
                      value={
                        Array.isArray(debugConfig.sanitize) &&
                        debugConfig.sanitize.length > 0
                          ? debugConfig.sanitize.length
                          : 0
                      }
                    />
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <p
                        className={`mb-1 text-[11px] font-semibold ${
                          isDark ? "text-sky-300" : "text-sky-700"
                        }`}
                      >
                        Assistant config (
                        {assistantConfigLoading
                          ? "loading…"
                          : assistantConfigError
                          ? "error"
                          : assistantConfig
                          ? assistantConfig.assistant.name
                          : "n/a"}
                        )
                      </p>
                      {assistantConfigError && (
                        <p className="text-[11px] text-rose-400">
                          {assistantConfigError}
                        </p>
                      )}
                      {!assistantConfigLoading &&
                        !assistantConfigError &&
                        assistantConfig && (
                          <div className="space-y-1">
                            <DebugLine
                              isDark={isDark}
                              label="Instructions enabled:"
                              value={`${assistantConfig.instructions.filter((i) => i.enabled).length}/${assistantConfig.instructions.length}`}
                            />
                            <DebugLine
                              isDark={isDark}
                              label="Tools enabled:"
                              value={`${assistantConfig.tools.filter((t) => t.enabled).length}/${assistantConfig.tools.length}`}
                            />
                            <DebugLine
                              isDark={isDark}
                              label="Sanitization rules enabled:"
                              value={`${assistantConfig.sanitize.filter((r) => r.enabled).length}/${assistantConfig.sanitize.length}`}
                            />
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className={`mt-1 border-t pt-2 ${
              isDark ? "border-white/10" : "border-zinc-200"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEventsExpanded((prev) => !prev)}
                className={`flex w-full items-center justify-between text-[11px] font-semibold ${
                  isDark ? "text-sky-300" : "text-sky-700"
                }`}
              >
                <span>{t("chat.debug.events.title")}</span>
                <span className="text-[10px] text-slate-400">
                  {eventsExpanded
                    ? t("chat.debug.events.collapse")
                    : t("chat.debug.events.expand")}
                </span>
              </button>
            </div>
            {eventsExpanded && (
              <div className="space-y-1 pr-1">
                {debugEvents.length === 0 ? (
                  <p className="text-slate-400">
                    {t("chat.debug.events.empty")}
                  </p>
                ) : (
                  debugEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1 ${
                        isDark ? "bg-neutral-800/70" : "bg-zinc-100"
                      }`}
                    >
                      {event.meta && (
                        <span className="mt-[2px] inline-flex shrink-0 rounded-full bg-sky-500/20 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                          {event.meta}
                        </span>
                      )}
                      <span
                        className={`break-words text-[11px] ${
                          isDark ? "text-slate-100" : "text-slate-800"
                        }`}
                      >
                        {event.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleDebugResizeStart(e);
          }}
          className={`absolute bottom-1 right-1 flex h-4 w-4 cursor-se-resize items-center justify-center rounded-md border ${
            isDark
              ? "border-sky-500/70 bg-neutral-800/90 text-sky-300 hover:bg-neutral-700"
              : "border-zinc-300 bg-zinc-200 text-slate-700 hover:bg-zinc-300"
          }`}
          aria-label={t("chat.debug.resize")}
        >
          <span className="inline-block h-2 w-2 rounded-sm border border-current" />
        </button>
      </div>
    </div>
  );
}

function Pill({ isDark, label }: { isDark: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
        isDark
          ? "bg-neutral-800/80 text-slate-300"
          : "bg-zinc-100 text-slate-700"
      }`}
    >
      {label}
    </span>
  );
}

function DebugLine({
  isDark,
  label,
  value,
}: {
  isDark: boolean;
  label: string;
  value: string | number;
}) {
  return (
    <p
      className={`text-[11px] ${isDark ? "text-slate-200" : "text-slate-700"}`}
    >
      <span
        className={`font-semibold ${
          isDark ? "text-sky-300" : "text-sky-700"
        }`}
      >
        {label}
      </span>{" "}
      {value}
    </p>
  );
}
