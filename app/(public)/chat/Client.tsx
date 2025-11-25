"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Aperture,
  ArrowUp,
  AudioLines,
  Bug,
  Copy,
  Ellipsis,
  Grip,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  PanelLeft,
  Phone,
  Search,
  Settings,
  Sun,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { MarkdownMessage } from "@/components/ui/MarkdownMessage";
import { Tooltip } from "@/components/ui/Tooltip";
import { labTheme } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeContext";
import { useLocale } from "@/components/locale/LocaleContext";
import {
  useRealtimeVoiceSession,
  VoiceMessage,
} from "@/lib/voice/useRealtimeVoiceSession";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { IconButton } from "@/components/ui/IconButton";

const START_CALL_PROMPT =
  "Arranca una conversación de voz amable y breve en español. Presentate y pregunta en qué puedes ayudar.";

type ChatClientProps = {
  initialSidebarCollapsed: boolean;
};

export default function ChatClientPage({
  initialSidebarCollapsed,
}: ChatClientProps) {
  const {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    wsConnected,
    callStatus,
    inCall,
    assistantTalking,
    isRecording,
    muted,
    micMuted,
    currentScope,
    startCall,
    endCall,
    toggleSpeaker: voiceToggleSpeaker,
    toggleMic: voiceToggleMic,
    sendUserMessage,
  } = useRealtimeVoiceSession({
    startCallPrompt: START_CALL_PROMPT,
    initialScope: "support",
  });

  const [showMobileControls, setShowMobileControls] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed
  );
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showHeaderDivider, setShowHeaderDivider] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [debugConfig, setDebugConfig] = useState<{
    profile?: any;
    tools?: any;
    sanitize?: any;
  } | null>(null);
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
  const [configExpanded, setConfigExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(true);
  const [isNewChatLayout, setIsNewChatLayout] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { locale, setLocale, t } = useLocale();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasTypedInput = input.trim().length > 0;
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const setSidebarCollapsedAndPersist = useCallback(
    (next: boolean) => {
      setSidebarCollapsed(next);
      try {
        document.cookie = `va-sidebar-collapsed=${
          next ? "true" : "false"
        }; path=/; max-age=31536000`;
      } catch {
        // Best-effort only; if cookies are disabled we still update local state.
      }
    },
    []
  );

  function speak(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Only replay using the assistant's own Realtime voice
    // when there is an active voice call.
    if (callStatus !== "in_call") {
      return;
    }
    const prompt = `Repite exactamente este mensaje en voz usando tu propia voz, sin añadir nada más:\n\n${trimmed}`;
    void sendUserMessage(prompt, { silent: true });
  }

  function scrollToBottom() {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }

  function toggleSpeaker() {
    voiceToggleSpeaker();
  }

  function toggleMic() {
    voiceToggleMic();
  }

  function handleStartCall() {
    setIsNewChatLayout(false);
    startCall();
  }

  function handleSendText() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setIsNewChatLayout(false);
    void sendUserMessage(trimmed);
    setInput("");
  }

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.from !== "system"),
    [messages]
  );

  const debugEvents = useMemo(
    () => messages.filter((m) => m.from === "system"),
    [messages]
  );

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

  useEffect(() => {
    if (!showDebug) return;
    if (debugConfig) return;
    let cancelled = false;
    setDebugLoading(true);
    setDebugError(null);

    async function loadDebugConfig() {
      try {
        const [profileRes, toolsRes, sanitizeRes] = await Promise.all([
          fetch("/api/config/profile"),
          fetch("/api/config/tools"),
          fetch("/api/config/sanitize"),
        ]);
        if (cancelled) return;
        if (!profileRes.ok || !toolsRes.ok || !sanitizeRes.ok) {
          throw new Error("Failed to load debug configuration");
        }
        const [profileJson, toolsJson, sanitizeJson] = await Promise.all([
          profileRes.json(),
          toolsRes.json(),
          sanitizeRes.json(),
        ]);
        setDebugConfig({
          profile: profileJson.profile,
          tools: toolsJson.tools,
          sanitize: sanitizeJson.sanitize,
        });
      } catch (err: any) {
        if (cancelled) return;
        setDebugError(err?.message || "Unknown error loading debug config");
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
  }, [showDebug, debugConfig]);

  useEffect(() => {
    scrollToBottom();
    const chatEl = chatRef.current;
    if (!chatEl) return;
    const updateHeaderDivider = () => {
      const canScroll = chatEl.scrollHeight > chatEl.clientHeight;
      setShowHeaderDivider(canScroll && chatEl.scrollTop > 0);
    };
    updateHeaderDivider();
    chatEl.addEventListener("scroll", updateHeaderDivider);
    return () => {
      chatEl.removeEventListener("scroll", updateHeaderDivider);
    };
  }, [messages]);

  // Global keyboard shortcuts (New chat, Search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // ⇧ ⌘ O → New chat
      if (key === "o" && e.shiftKey) {
        e.preventDefault();
        setMessages([]);
        setInput("");
        return;
      }

      // ⌘ K → focus search / input
      if (key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMessages, setInput]);

  return (
    <main
      className={`min-h-screen overflow-hidden ${
        isDark
          ? "bg-neutral-800 text-slate-100"
          : "bg-zinc-50 text-slate-900"
      }`}
      style={isDark ? { backgroundImage: labTheme.gradients.canvas } : undefined}
    >
          <div className="flex h-screen overflow-hidden">
        <aside
          className={`flex-col border-r backdrop-blur-xl transition-[transform] duration-300 ${
            isDark
              ? sidebarCollapsed
                ? "border-white/5 bg-neutral-800/80"
                : "border-white/5 bg-neutral-800/70"
              : sidebarCollapsed
              ? "border-zinc-200/60 bg-white/70"
              : "border-zinc-200/60 bg-zinc-50"
          } ${
            showMobileSidebar
              ? "fixed inset-y-0 left-0 z-40 flex h-full w-[60vw] max-w-sm translate-x-0 shadow-2xl md:relative md:w-auto md:translate-x-0"
              : "hidden -translate-x-full md:relative md:flex md:h-full md:w-auto md:translate-x-0"
          }`}
          style={
            showMobileSidebar
              ? undefined
              : {
                  width: sidebarCollapsed ? 52 : 260,
                }
          }
        >
          <div className="flex items-center gap-2 px-2 py-2">
            <IconButton
              onClick={() => {
                if (sidebarCollapsed) {
                  setSidebarCollapsedAndPersist(false);
                }
              }}
              className="group rounded-xl"
              isDark={isDark}
              aria-label={
                sidebarCollapsed
                  ? t("chat.aria.sidebar.expand")
                  : t("chat.aria.sidebar.menu")
              }
            >
              {sidebarCollapsed ? (
                <>
                  <Aperture className="h-5 w-5 group-hover:hidden" />
                  <PanelLeft className="hidden h-5 w-5 group-hover:inline-block" />
                </>
              ) : (
                <Aperture className="h-5 w-5" />
              )}
            </IconButton>
            {!sidebarCollapsed && (
              <IconButton
                className={`ml-auto rounded-xl text-sm font-semibold ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
                isDark={isDark}
                onClick={() => {
                  if (showMobileSidebar) {
                    setShowMobileSidebar(false);
                  } else {
                    setSidebarCollapsedAndPersist(true);
                  }
                }}
              >
                {showMobileSidebar ? (
                  <Tooltip label={t("chat.sidebar.close")}>
                    <span>
                      <X className="h-5 w-5" />
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip label={t("chat.sidebar.collapse")}>
                    <span>
                      <PanelLeft className="h-5 w-5" />
                    </span>
                  </Tooltip>
                )}
              </IconButton>
            )}
          </div>

          <div className="mt-2 space-y-1 px-2">
            {["new", "search", "settings"].map((key) => {
              const icon =
                key === "new"
                  ? MessageSquare
                  : key === "search"
                  ? Search
                  : Settings;
              const Icon = icon;
              const label =
                key === "new"
                  ? t("chat.sidebar.newChat")
                  : key === "search"
                  ? t("chat.sidebar.search")
                  : t("chat.sidebar.settings");
              const shortcut =
                key === "new" ? "⇧ ⌘ O" : key === "search" ? "⌘ K" : "";
              return (
                <button
                  key={key}
                  className={`group flex w-full items-center rounded-xl px-2 py-2 text-left transition cursor-pointer ${
                    isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"
                  }`}
                  type="button"
                  onClick={() => {
                    if (key === "settings") {
                      setShowSettingsDialog(true);
                    } else if (key === "new") {
                      setMessages([]);
                      setInput("");
                      setIsNewChatLayout(true);
                    }
                  }}
                >
                  {sidebarCollapsed ? (
                    <Tooltip
                      label={
                        shortcut ? (
                          <span className="flex items-center gap-2">
                            <span>{label}</span>
                            <span className="text-zinc-400">{shortcut}</span>
                          </span>
                        ) : (
                          label
                        )
                      }
                    >
                      <div className="flex w-full justify-center">
                        <Icon
                          className={`h-5 w-5 ${
                            isDark ? "text-slate-200" : "text-slate-700"
                          }`}
                        />
                      </div>
                    </Tooltip>
                  ) : (
                    <>
                      <div className="flex flex-1 items-center gap-3">
                        <Icon
                          className={`h-5 w-5 ${
                            isDark ? "text-slate-200" : "text-slate-700"
                          }`}
                        />
                        <span
                          className={`text-sm font-medium ${
                            isDark ? "text-slate-100" : "text-slate-900"
                          }`}
                        >
                          {key === "new"
                            ? t("chat.sidebar.newChat")
                            : key === "search"
                            ? t("chat.sidebar.search")
                            : t("chat.sidebar.settings")}
                        </span>
                      </div>
                      {key === "new" && (
                        <span className="ml-auto mr-1 text-xs font-medium text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-gray-500 transition-opacity">
                          ⇧ ⌘ O
                        </span>
                      )}
                      {key === "search" && (
                        <span className="ml-auto mr-1 text-xs font-medium text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-gray-500 transition-opacity">
                          ⌘ K
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto px-2 py-3">
            <button
              type="button"
              className={`group flex items-center rounded-xl px-2 py-2 text-left text-sm transition ${
                sidebarCollapsed
                  ? "h-10 w-10 justify-center mx-auto"
                  : "w-full gap-3"
              } ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"}`}
            >
              <User
                className={`h-6 w-6 ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              />
              {!sidebarCollapsed && (
                <div className="ml-2 flex flex-col">
                  <span
                    className={`text-sm font-medium ${
                      isDark ? "text-slate-100" : "text-slate-900"
                    }`}
                  >
                    {t("chat.profile.name")}
                  </span>
                  <span
                    className={`text-xs ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {t("chat.profile.email")}
                  </span>
                </div>
              )}
            </button>
          </div>
        </aside>

        {showMobileSidebar && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setShowMobileSidebar(false)}
            aria-hidden
          />
        )}
        <div
          className={`flex flex-1 flex-col min-w-0 backdrop-blur-xl ${
            isDark ? "bg-neutral-800/80" : "bg-white/70"
          }`}
        >
          <header
            className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-transparent px-2 py-2 transition-colors ${
              showHeaderDivider ? "border-white/10" : "border-transparent"
            } relative`}
          >
            <div className="flex items-center gap-1.5">
              <IconButton
                onClick={() =>
                  setShowMobileSidebar((prev) => {
                    const next = !prev;
                    if (next) {
                      setSidebarCollapsedAndPersist(true);
                    }
                    return next;
                  })
                }
                className={`md:hidden rounded-lg ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
                aria-label={t("chat.aria.header.toggleMenu")}
              >
                <Menu className="h-5 w-5" />
              </IconButton>
              <div
                className={`flex h-10 items-center gap-2 rounded-lg border px-3 transition ${
                  isDark
                    ? "border-transparent bg-transparent hover:border-transparent hover:bg-white/5"
                    : "border-transparent bg-transparent hover:border-transparent hover:bg-zinc-100"
                }`}
              >
                <span
                  className={`text-lg font-normal ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Voice Agent
                </span>
                <span
                  className={`status-dot ${wsConnected ? "dot-online" : "dot-offline"} h-2.5 w-2.5`}
                  aria-hidden
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <IconButton
                isDark={isDark}
                variant="ghost"
                className="rounded-lg"
                onClick={() => setShowMenu((prev) => !prev)}
              >
                <Tooltip label={t("chat.menu.moreOptions")}>
                  <span>
                    <Ellipsis className="h-5 w-5" />
                  </span>
                </Tooltip>
              </IconButton>
              <IconButton
                size="sm"
                variant="outline"
                isDark={isDark}
                className={`sm:hidden rounded-xl ${
                  showMobileControls
                    ? ""
                    : isDark
                    ? "text-white/50"
                    : "text-slate-700"
                }`}
                onClick={() => setShowMobileControls((prev) => !prev)}
                aria-label={
                  showMobileControls
                    ? t("chat.aria.mobileControls.hide")
                    : t("chat.aria.mobileControls.show")
                }
              >
                <Grip
                  className={`h-4 w-4 ${
                    showMobileControls ? "opacity-100" : "opacity-60"
                  }`}
                />
              </IconButton>
            </div>
          </header>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
                aria-hidden
              />
              <div
                className={`absolute right-4 top-14 z-30 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
                  isDark
                    ? "border-white/10 bg-neutral-800/95"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowDebug((prev) => !prev);
                    setShowMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-t-xl px-3 py-2 text-[15px] cursor-pointer ${
                    isDark
                      ? "text-slate-100 hover:bg-white/10"
                      : "text-slate-800 hover:bg-zinc-50"
                  }`}
                >
                  <Bug className="h-3.5 w-3.5 text-sky-300" />
                  <span className="flex-1 text-left">
                    {t("chat.menu.debug")} {showDebug ? "(on)" : "(off)"}
                  </span>
                </button>
                {/* Additional menu entries removed: theme and language now live in Settings dialog */}
              </div>
            </>
          )}

          <div className="flex flex-1 flex-col min-h-0 px-4 pb-6 sm:px-6 md:px-10">
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto pt-6 pb-4 pr-1"
            >
              {isNewChatLayout && visibleMessages.length === 0 && (
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
                  <div className="mt-6 w-full max-w-3xl">
                    <div className="relative">
                      <input
                        type="text"
                        ref={inputRef}
                        className={`h-14 w-full rounded-full border pl-5 pr-16 text-base placeholder:text-neutral-400 focus:outline-none ${
                          isDark
                            ? "border-white/10 bg-white/10 text-slate-100"
                            : "border-zinc-300 bg-white text-slate-900"
                        }`}
                        placeholder={t("chat.input.placeholderIdle")}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendText();
                          }
                        }}
                        disabled={!wsConnected}
                      />
                      <Tooltip
                        placement="above"
                        offset={12}
                        label={
                          hasTypedInput
                            ? t("chat.tooltip.send")
                            : t("chat.tooltip.startVoiceCall")
                        }
                      >
                        <button
                          onClick={() => {
                            if (hasTypedInput) {
                              handleSendText();
                            } else if (
                              callStatus !== "calling" &&
                              callStatus !== "in_call"
                            ) {
                              handleStartCall();
                            }
                          }}
                          className={`absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                            hasTypedInput
                              ? isDark
                                ? "border-white/20 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                                : "border-zinc-300 bg-zinc-100 text-slate-900 hover:border-zinc-400 hover:bg-zinc-200 cursor-pointer"
                              : isDark
                              ? "border-white/30 bg-white/15 text-white/80 hover:border-white/40 hover:bg-white/25 hover:text-white cursor-pointer"
                              : "border-zinc-300 bg-zinc-100 text-slate-800 hover:border-zinc-400 hover:bg-zinc-200 cursor-pointer"
                          }`}
                          disabled={!wsConnected || callStatus === "calling"}
                        >
                          {hasTypedInput ? (
                            <ArrowUp className="h-5 w-5" />
                          ) : (
                            <AudioLines className="h-5 w-5" />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}

              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {visibleMessages.map((message, idx) => {
                  const isAssistant = message.from === "assistant";
                  const showActions = isAssistant && !loading;
                  const isLast = idx === messages.length - 1;
                  // For assistant messages, render markdown content with actions.
                  if (isAssistant) {
                    return (
                      <div key={message.id} className="space-y-2 px-1">
                        <MarkdownMessage text={message.text} />
                        {showActions && (
                          <div
                            className="flex items-center gap-1"
                            style={{ opacity: isLast ? 1 : 1 }}
                          >
                            <IconButton
                              size="sm"
                              isDark={isDark}
                              variant="ghost"
                              className="rounded-lg"
                              onClick={() => void handleCopy(message.text)}
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
                              onClick={() => void speak(message.text)}
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

                  // For user/system messages, keep bubbles, but if it's a
                  // pending user utterance placeholder ("…"), render a
                  // breathing dot aligned to the user side instead of text.
                  const isPendingUserUtterance =
                    message.from === "user" && message.text === "…";

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

                  return (
                    <ChatBubble
                      key={message.id}
                      from={message.from}
                      meta={message.meta}
                      variant="lab"
                      className={`rounded-[18px] ${
                        message.from === "user"
                          ? "rounded-[24px] px-3 py-2 text-lg leading-relaxed"
                          : ""
                      }`}
                    >
                      {message.text}
                    </ChatBubble>
                  );
                })}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="status-dot dot-online" />
                    {t("chat.status.thinking")}
                  </div>
                )}
              </div>
            </div>

            {showDebug && (
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
                  <div
                    className="mb-2 cursor-move pr-6"
                    onMouseDown={handleDebugDragStart}
                  >
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        WS: {wsConnected ? "connected" : "disconnected"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Call: {callStatus}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Mic: {micMuted ? "muted" : "open"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Speaker: {muted ? "muted" : "on"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Assistant: {assistantTalking ? "speaking" : "idle"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Scope: {currentScope || "n/a"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDebug(false);
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
                            <p className="text-slate-400">
                              Loading debug config…
                            </p>
                          )}
                          {debugError && (
                            <p className="text-rose-400">
                              Error loading config: {debugError}
                            </p>
                          )}
                          {!debugLoading && !debugError && debugConfig && (
                            <div className="space-y-1">
                              <p
                                className={`text-[11px] ${
                                  isDark ? "text-slate-200" : "text-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold ${
                                    isDark
                                      ? "text-sky-300"
                                      : "text-sky-700"
                                  }`}
                                >
                                  Profile blocks:
                                </span>{" "}
                                {Object.keys(
                                  debugConfig.profile ?? {}
                                ).join(", ") || "none"}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  isDark ? "text-slate-200" : "text-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold ${
                                    isDark
                                      ? "text-sky-300"
                                      : "text-sky-700"
                                  }`}
                                >
                                  Tools:
                                </span>{" "}
                                {Array.isArray(debugConfig.tools) &&
                                debugConfig.tools.length > 0
                                  ? debugConfig.tools
                                      .map((t: any) => t.name)
                                      .join(", ")
                                  : "none"}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  isDark ? "text-slate-200" : "text-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold ${
                                    isDark
                                      ? "text-sky-300"
                                      : "text-sky-700"
                                  }`}
                                >
                                  Sanitize rules:
                                </span>{" "}
                                {Array.isArray(debugConfig.sanitize) &&
                                debugConfig.sanitize.length > 0
                                  ? debugConfig.sanitize.length
                                  : 0}
                              </p>
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
                                  isDark
                                    ? "bg-neutral-800/70"
                                    : "bg-zinc-100"
                                }`}
                              >
                                {event.meta && (
                                  <span className="mt-[2px] inline-flex shrink-0 rounded-full bg-sky-500/20 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                                    {event.meta}
                                  </span>
                                )}
                                <span
                                  className={`break-words text-[11px] ${
                                    isDark
                                      ? "text-slate-100"
                                      : "text-slate-800"
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
                    <Grip className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {!isNewChatLayout && (
              <div className="mx-auto w-full max-w-3xl px-1 sm:px-1">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      ref={inputRef}
                      className={`h-14 w-full rounded-full border pl-5 pr-16 text-base placeholder:text-neutral-400 focus:outline-none ${
                        isDark
                          ? "border-white/10 bg-white/10 text-slate-100"
                          : "border-zinc-300 bg-white text-slate-900"
                      }`}
                      placeholder={
                        callStatus === "in_call"
                          ? t("chat.input.placeholderInCall")
                          : t("chat.input.placeholderIdle")
                      }
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (input.trim()) {
                            handleSendText();
                          }
                        }
                      }}
                      disabled={!wsConnected}
                    />
                    <Tooltip
                      placement="above"
                      offset={12}
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
                          if (hasTypedInput) {
                            handleSendText();
                          } else {
                            if (callStatus === "calling") return;
                            if (callStatus === "in_call") {
                              endCall();
                            } else {
                              handleStartCall();
                            }
                          }
                        }}
                        className={`absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                          hasTypedInput
                            ? isDark
                              ? "border-white/20 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                              : "border-zinc-300 bg-zinc-100 text-slate-900 hover:border-zinc-400 hover:bg-zinc-200 cursor-pointer"
                            : callStatus === "in_call"
                            ? "border-rose-400/70 bg-rose-500/90 text-white hover:bg-rose-400 cursor-pointer"
                            : isDark
                            ? "border-white/30 bg-white/15 text-white/80 hover:border-white/40 hover:bg-white/25 hover:text-white cursor-pointer"
                            : "border-zinc-300 bg-zinc-100 text-slate-800 hover:border-zinc-400 hover:bg-zinc-200 cursor-pointer"
                        }`}
                        disabled={
                          hasTypedInput
                            ? !wsConnected
                            : !wsConnected || callStatus === "calling"
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
            )}

            {showMobileControls && (
              <div className="sm:hidden">
                <div className="mx-auto mt-4 flex w-full max-w-md items-center justify-center gap-4 px-2">
                  <button
                    onClick={toggleSpeaker}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-white transition ${
                      muted
                        ? "border-amber-500 bg-amber-500 text-slate-900"
                        : isDark
                        ? "border-white/20 bg-neutral-800"
                        : "border-zinc-300 bg-zinc-800"
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
                          <VolumeX strokeWidth={1.8} className="h-5 w-5" />
                        ) : (
                          <Volume2 strokeWidth={1.8} className="h-5 w-5" />
                        )}
                      </span>
                    </Tooltip>
                  </button>
                  <button
                    onClick={() => {
                      if (callStatus === "in_call") {
                        endCall();
                      } else if (callStatus !== "calling") {
                        handleStartCall();
                      }
                    }}
                    className={`flex h-16 w-16 items-center justify-center rounded-full border text-white transition active:scale-95 ${
                      callStatus === "in_call"
                        ? "border-rose-500/50 bg-rose-500"
                        : callStatus === "calling"
                        ? "border-amber-400/60 bg-amber-500 animate-pulse"
                        : "border-emerald-400/60 bg-emerald-500"
                    }`}
                  >
                    <Tooltip
                      label={
                        callStatus === "in_call"
                          ? t("chat.tooltip.endCall")
                          : t("chat.tooltip.startCall")
                      }
                    >
                      <span>
                        <Phone
                          className={`h-7 w-7 ${
                            callStatus === "in_call" ? "rotate-135" : ""
                          }`}
                        />
                      </span>
                    </Tooltip>
                  </button>
                  <button
                    onClick={toggleMic}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-white transition ${
                      micMuted
                        ? "border-rose-500 bg-rose-500 text-white"
                        : isDark
                        ? "border-white/20 bg-neutral-800"
                        : "border-zinc-300 bg-zinc-800"
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
                          <MicOff strokeWidth={1.8} className="h-5 w-5" />
                        ) : (
                          <Mic strokeWidth={1.8} className="h-5 w-5" />
                        )}
                      </span>
                    </Tooltip>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <SettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      />
    </main>
  );
}
