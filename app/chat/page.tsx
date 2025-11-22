"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  AudioLines,
  Copy,
  Ellipsis,
  Grip,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Plus,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { MarkdownMessage } from "@/components/ui/MarkdownMessage";
import { labTheme } from "@/lib/theme";
import {
  useRealtimeVoiceSession,
  VoiceMessage,
} from "@/lib/voice/useRealtimeVoiceSession";

const START_CALL_PROMPT =
  "Arranca una conversación de voz amable y breve en español. Presentate y pregunta en qué puedes ayudar.";

export default function MobileVoiceChat() {
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showHeaderDivider, setShowHeaderDivider] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const hasTypedInput = input.trim().length > 0;
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

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

  // Ensure initial welcome message appears once
  useEffect(() => {
    setMessages((prev: VoiceMessage[]) =>
      prev.length
        ? prev
        : [
            {
              id: "welcome",
              from: "assistant",
              text: "Hola, soy tu asistente. Toca el botón para empezar una llamada de voz.",
            },
          ]
    );
  }, [setMessages]);

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

  const suggestions = useMemo(
    () => [
      "Dame un resumen rápido",
      "Repregunta si necesitas detalles",
      "Activa modo breve con respuestas de 2 frases",
    ],
    []
  );

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

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden"
      style={{ backgroundImage: labTheme.gradients.canvas }}
    >
          <div className="flex h-screen overflow-hidden">
        <aside
          className={`flex-col border-r border-white/5 bg-black/30 backdrop-blur-xl transition-[transform] duration-300 ${
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
          <div className="flex items-center gap-2 px-4 py-4">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-white/30"
              aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <ArrowLeft
                className={`h-4 w-4 transition ${sidebarCollapsed ? "rotate-180" : ""}`}
              />
            </button>
            <button
              className={`ml-auto flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 ${
                sidebarCollapsed ? "w-10 px-0" : ""
              }`}
              type="button"
              title="Nuevo chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 space-y-1 px-2">
            {["Demo retail", "Atención cliente", "Ideas para script"].map(
              (thread, idx) => (
                <button
                  key={thread}
                  className={`group flex w-full items-center gap-3 rounded-xl border border-white/5 px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/5 ${
                    idx === 0 ? "bg-white/5" : ""
                  }`}
                  type="button"
                >
                  <MessageSquare className="h-4 w-4 text-slate-200" />
                  {!sidebarCollapsed && (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">{thread}</span>
                      <span className="text-xs text-slate-400">Sesión rápida</span>
                    </div>
                  )}
                </button>
              )
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="mt-6 px-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Atajos
              </p>
              <div className="mt-3 space-y-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion}
                    className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto border-t border-white/5 px-4 py-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/10"
            >
              <Settings className="h-4 w-4" />
              {!sidebarCollapsed && <span>Preferencias</span>}
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
        <div className="flex flex-1 flex-col min-w-0 bg-black/30 backdrop-blur-xl">
          <header
            className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-transparent px-4 py-3 transition-colors sm:px-6 md:px-2 ${
              showHeaderDivider ? "border-white/10" : "border-transparent"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMobileSidebar((prev) => !prev)}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-transparent text-white transition sm:hidden"
                aria-label="Toggle menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-transparent px-3 transition hover:border-transparent hover:bg-white/5">
                <span className="text-lg font-normal text-white">Voice Agent</span>
                <span
                  className={`status-dot ${wsConnected ? "dot-online" : "dot-offline"} h-2.5 w-2.5`}
                  aria-hidden
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-white transition hover:border-transparent hover:bg-white/5"
                title="Más opciones"
              >
                <Ellipsis className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowMobileControls((prev) => !prev)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition sm:hidden ${
                  showMobileControls
                    ? "border-white/20 bg-white/10 text-white hover:border-white/40"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                }`}
                aria-label={showMobileControls ? "Ocultar controles" : "Mostrar controles"}
              >
                <Grip className={`h-4 w-4 ${showMobileControls ? "opacity-100" : "opacity-60"}`} />
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col min-h-0 px-4 pb-6 sm:px-6 md:px-10">
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto pt-6 pb-4 pr-1"
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {messages.map((message, idx) => {
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
                          className="flex items-center gap-2"
                          style={{ opacity: isLast ? 1 : 1 }}
                        >
                          <button
                            type="button"
                            onClick={() => void handleCopy(message.text)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
                            title="Copiar"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void speak(message.text)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
                            title="Reproducir audio"
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
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
                    El asistente está pensando…
                  </div>
                )}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-2 sm:px-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    className="h-14 w-full rounded-full border border-white/10 bg-white/10 pl-5 pr-16 text-base text-white placeholder:text-slate-500 focus:outline-none"
                    placeholder={
                      callStatus === "in_call"
                        ? "Habla o escribe aquí…"
                        : "Pulsa el botón para iniciar la llamada"
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (input.trim()) {
                          void sendUserMessage(input);
                          setInput("");
                        }
                      }
                    }}
                    disabled={!wsConnected}
                  />
                  <button
                    onClick={() => {
                      if (hasTypedInput) {
                        void sendUserMessage(input);
                        setInput("");
                      } else {
                        if (callStatus === "calling") return;
                        if (callStatus === "in_call") {
                          endCall();
                        } else {
                          startCall();
                        }
                      }
                    }}
                    className={`absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                      hasTypedInput
                        ? "border-white/20 bg-white text-slate-900 hover:bg-slate-100 cursor-pointer"
                        : callStatus === "in_call"
                        ? "border-rose-400/70 bg-rose-500/90 text-white hover:bg-rose-400 cursor-pointer"
                        : "border-white/30 bg-white/15 text-white/80 hover:border-white/40 hover:bg-white/25 hover:text-white cursor-pointer"
                    }`}
                    title={
                      hasTypedInput
                        ? "Enviar"
                        : callStatus === "in_call"
                        ? "Terminar llamada"
                        : "Iniciar llamada de voz"
                    }
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
                </div>
              </div>
            </div>

            {showMobileControls && (
              <div className="sm:hidden">
                <div className="mx-auto mt-4 flex w-full max-w-md items-center justify-center gap-4 px-2">
                  <button
                    onClick={toggleSpeaker}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-white transition ${
                      muted
                        ? "border-amber-500 bg-amber-500 text-slate-900"
                        : "border-white/20 bg-slate-900"
                    }`}
                    title={muted ? "Activar altavoz" : "Silenciar altavoz"}
                  >
                    {muted ? (
                      <VolumeX strokeWidth={1.8} className="h-5 w-5" />
                    ) : (
                      <Volume2 strokeWidth={1.8} className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (callStatus === "in_call") {
                        endCall();
                      } else if (callStatus !== "calling") {
                        startCall();
                      }
                    }}
                    className={`flex h-16 w-16 items-center justify-center rounded-full border text-white transition active:scale-95 ${
                      callStatus === "in_call"
                        ? "border-rose-500/50 bg-rose-500"
                        : callStatus === "calling"
                        ? "border-amber-400/60 bg-amber-500 animate-pulse"
                        : "border-emerald-400/60 bg-emerald-500"
                    }`}
                    title={callStatus === "in_call" ? "Terminar llamada" : "Iniciar llamada"}
                  >
                    <Phone
                      className={`h-7 w-7 ${
                        callStatus === "in_call" ? "rotate-135" : ""
                      }`}
                    />
                  </button>
                  <button
                    onClick={toggleMic}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-white transition ${
                      micMuted
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-white/20 bg-slate-900"
                    }`}
                    title={micMuted ? "Activar micro" : "Silenciar micro"}
                  >
                    {micMuted ? (
                      <MicOff strokeWidth={1.8} className="h-5 w-5" />
                    ) : (
                      <Mic strokeWidth={1.8} className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
