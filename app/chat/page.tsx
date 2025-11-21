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
import { labTheme } from "@/lib/theme";

type ChatMessage = {
  id: string;
  from: "user" | "assistant" | "system";
  text: string;
  meta?: string;
};

const START_CALL_PROMPT =
  "Arranca una conversación de voz amable y breve en español. Presentate y pregunta en qué puedes ayudar.";

export default function MobileVoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      from: "assistant",
      text: "Hola, soy tu asistente. Toca el botón para empezar una llamada de voz.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "in_call">(
    "idle"
  );
  const [showMobileControls, setShowMobileControls] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showHeaderDivider, setShowHeaderDivider] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [isRecording, setIsRecordingState] = useState(false);
  const [assistantTalking, setAssistantTalking] = useState(false);

  const chatRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAssistantTextRef = useRef("");
  const pendingAssistantTextRef = useRef<string | null>(null);
  const currentResponseIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropAssistantResponsesRef = useRef(false);
  const introPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantPlaceholderRef = useRef(false);
  const isRecordingRef = useRef(false);
  const micMutedRef = useRef(false);
  const assistantTalkingRef = useRef(false);
  const inCallRef = useRef(false);
  const mutedRef = useRef(false);

  const hasTypedInput = input.trim().length > 0;
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = muted ? 0 : 1;
    }
  }, [muted]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    micMutedRef.current = micMuted;
    mutedRef.current = muted;
    assistantTalkingRef.current = assistantTalking;
  }, [micMuted, muted, assistantTalking]);

  useEffect(() => {
    return () => {
      if (introPromptTimeoutRef.current) {
        clearTimeout(introPromptTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let didUnmount = false;

    const scheduleReconnect = () => {
      if (didUnmount || reconnectTimeoutRef.current) return;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, 1500);
    };

    const connect = () => {
      if (didUnmount) return;
      const ws = new WebSocket("ws://localhost:4001");
      wsRef.current = ws;

      ws.onopen = () => {
        if (didUnmount) return;
        setWsConnected(true);
        pushSystem("Conectado al servidor en tiempo real", "online");
      };

      ws.onclose = () => {
        if (didUnmount) return;
        inCallRef.current = false;
        setWsConnected(false);
        pushSystem("Desconectado. Reintentando…", "warning");
        setCallStatus("idle");
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (didUnmount) return;
        pushSystem("Error de WebSocket. Comprueba el servidor.", "error");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "response.text.delta") {
            const delta: string = data.delta ?? "";
            if (!delta) return;
            currentAssistantTextRef.current += delta;
          }

          if (data.type === "response.created") {
            const id = data.response?.id || data.id;
            if (id) {
              currentResponseIdRef.current = id;
            }
          }

          if (data.type === "response.text.done") {
            const finalText = currentAssistantTextRef.current;
            currentAssistantTextRef.current = "";
            if (!finalText || dropAssistantResponsesRef.current) {
              pendingAssistantTextRef.current = null;
              setLoading(false);
              return;
            }
            pendingAssistantTextRef.current = finalText;

            const shouldSpeak =
              inCallRef.current && !mutedRef.current && typeof data.text === "string";

            if (shouldSpeak) {
              void speak(data.text, () => flushPendingAssistantText(60));
            } else {
              flushPendingAssistantText(60);
            }
          }

          if (data.type === "response.done") {
            const finishedId = data.response?.id || data.id;
            if (
              finishedId &&
              currentResponseIdRef.current &&
              finishedId === currentResponseIdRef.current
            ) {
              currentResponseIdRef.current = null;
            }
            if (!pendingAssistantTextRef.current) {
              setLoading(false);
            }
          }

          if (
            data.type === "error" ||
            data.type === "response.error" ||
            data.error
          ) {
            const message =
              data?.error?.message ||
              data?.message ||
              "Error en respuesta (revisa logs)";
            pushSystem(message, "error");
            setLoading(false);
          }
        } catch (err) {
          console.error("Parse error", err);
          setLoading(false);
        }
      };
    };

    connect();

    return () => {
      didUnmount = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API no disponible");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      if (micMutedRef.current) return;
      const results = event.results;
      const lastResult = results[results.length - 1];
      const transcript = lastResult[0].transcript;
      void sendUserMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      const error = event?.error;
      if (error === "no-speech") {
        console.warn("SpeechRecognition warning: no-speech");
        return;
      }
      if (error === "network") {
        console.warn("SpeechRecognition warning: network issue");
        ensureMicActive();
        return;
      }
      console.error("SpeechRecognition error:", error);
      setIsRecordingState(false);
    };

    recognition.onend = () => {
      if (micMutedRef.current || assistantTalkingRef.current || !inCallRef.current) {
        setIsRecordingState(false);
        return;
      }
      ensureMicActive();
    };

    recognitionRef.current = recognition;
  }, []);

  function ensureMicActive() {
    const recognition = recognitionRef.current;
    if (
      !recognition ||
      micMutedRef.current ||
      !inCallRef.current ||
      assistantTalkingRef.current ||
      isRecordingRef.current
    ) {
      return;
    }

    try {
      recognition.start();
      setIsRecordingState(true);
    } catch (err: any) {
      if (err?.name === "InvalidStateError") {
        setIsRecordingState(true);
      } else {
        console.error("Error starting recognition:", err);
      }
    }
  }

  async function speak(text: string, onSpeechStart?: () => void) {
    if (!text.trim() || dropAssistantResponsesRef.current) return;

    const recognition = recognitionRef.current;
    if (recognition && isRecordingRef.current) {
      assistantTalkingRef.current = true;
      setAssistantTalking(true);
      try {
        recognition.stop();
      } catch (err) {
        console.error("Error stopping recognition before TTS:", err);
      }
      setIsRecordingState(false);
    }

    const triggerSpeechStart = (() => {
      let triggered = false;
      return () => {
        if (triggered) return;
        triggered = true;
        onSpeechStart?.();
      };
    })();

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "alloy" }),
      });

      if (!res.ok) {
        console.error("TTS error:", await res.text());
        triggerSpeechStart();
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (dropAssistantResponsesRef.current) {
        triggerSpeechStart();
        URL.revokeObjectURL(url);
        return;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = audio;
      audio.muted = mutedRef.current;
      audio.volume = mutedRef.current ? 0 : 1;

      if (!assistantTalkingRef.current) {
        assistantTalkingRef.current = true;
        setAssistantTalking(true);
      }

      const restartMic = () => {
        setAssistantTalking(false);
        assistantTalkingRef.current = false;
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        ensureMicActive();
      };

      audio.onended = restartMic;
      audio.onerror = (err) => {
        console.error("Playback error:", err);
        triggerSpeechStart();
        restartMic();
      };

      audio.onplay = triggerSpeechStart;

      audio.play().catch((err) => {
        console.error("Playback error:", err);
        triggerSpeechStart();
        restartMic();
      });
    } catch (err) {
      console.error("TTS fetch error:", err);
      triggerSpeechStart();
      setAssistantTalking(false);
      assistantTalkingRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      ensureMicActive();
    }
  }

  async function sendUserMessage(text: string, options?: { silent?: boolean }) {
    const trimmed = text.trim();
    if (
      !trimmed ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    dropAssistantResponsesRef.current = false;

    if (!options?.silent) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: "user", text: trimmed },
      ]);
    }
    setLoading(true);

    wsRef.current.send(
      JSON.stringify({
        type: "user_message",
        text: trimmed,
        scope: "support",
      })
    );
    setInput("");
  }

  function pushSystem(text: string, meta?: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), from: "system", text, meta },
    ]);
  }

  function ensureAssistantMessage() {
    if (assistantPlaceholderRef.current) return;
    assistantPlaceholderRef.current = true;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), from: "assistant", text: "" },
    ]);
  }

  function setLastAssistantText(nextText: string) {
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i -= 1) {
        if (updated[i].from === "assistant") {
          updated[i] = { ...updated[i], text: nextText };
          return updated;
        }
      }
      return [
        ...updated,
        { id: crypto.randomUUID(), from: "assistant", text: nextText },
      ];
    });
  }

  function stopTypingAnimation() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    assistantPlaceholderRef.current = false;
  }

  function startAssistantTyping(fullText: string, initialDelay = 300) {
    stopTypingAnimation();
    if (!fullText) {
      return;
    }
    ensureAssistantMessage();
    setLastAssistantText("");
    const baseOverhead = 400;
    const perChar = 16;
    const targetDuration = baseOverhead + perChar * fullText.length;
    const delay = Math.max(
      10,
      Math.min(65, targetDuration / Math.max(1, fullText.length))
    );
    let index = 0;
    const typeNext = () => {
      setLastAssistantText(fullText.slice(0, index + 1));
      index += 1;
      if (index < fullText.length) {
        typingTimeoutRef.current = setTimeout(typeNext, delay);
      } else {
        typingTimeoutRef.current = null;
        assistantPlaceholderRef.current = false;
      }
    };
    typingTimeoutRef.current = setTimeout(typeNext, Math.max(0, initialDelay));
  }

  function flushPendingAssistantText(delay = 120) {
    const text = pendingAssistantTextRef.current;
    if (!text) return;
    if (dropAssistantResponsesRef.current) {
      pendingAssistantTextRef.current = null;
      setLoading(false);
      return;
    }
    pendingAssistantTextRef.current = null;
    startAssistantTyping(text, delay);
    setLoading(false);
  }

  function startCall() {
    if (!wsConnected) {
      alert("Conecta primero con el servidor realtime");
      return;
    }
    dropAssistantResponsesRef.current = false;
    inCallRef.current = true;
    setCallStatus("calling");
    mutedRef.current = muted;
    audioRef.current && (audioRef.current.muted = mutedRef.current);
    pushSystem("Iniciando llamada…", "call");
    ensureMicActive();
    playCue("start");

    if (introPromptTimeoutRef.current) {
      clearTimeout(introPromptTimeoutRef.current);
    }
    introPromptTimeoutRef.current = setTimeout(() => {
      if (!inCallRef.current) return;
      setCallStatus("in_call");
      pushSystem("Llamada activa", "success");
      void sendUserMessage(START_CALL_PROMPT, { silent: true });
    }, 400);
  }

  function endCall() {
    inCallRef.current = false;
    setCallStatus("idle");
    setMuted(false);
    mutedRef.current = false;
    setMicMuted(false);
    setAssistantTalking(false);
    pendingAssistantTextRef.current = null;
    currentAssistantTextRef.current = "";
    stopTypingAnimation();
    dropAssistantResponsesRef.current = true;
    setLoading(false);
    pushSystem("Llamada finalizada", "call");
    playCue("end");

    if (
      currentResponseIdRef.current &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: "response.cancel",
          response_id: currentResponseIdRef.current,
        })
      );
      currentResponseIdRef.current = null;
    }

    const recognition = recognitionRef.current;
    if (recognition && isRecordingRef.current) {
      try {
        recognition.stop();
        setIsRecordingState(false);
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (introPromptTimeoutRef.current) {
      clearTimeout(introPromptTimeoutRef.current);
      introPromptTimeoutRef.current = null;
    }
  }

  function playCue(type: "start" | "end") {
    try {
      const AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = type === "start" ? 880 : 440;
      gain.gain.value = 0.2;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      oscillator.onended = () => ctx.close();
    } catch (err) {
      console.warn("Audio cue failed:", err);
    }
  }

  function scrollToBottom() {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }

  function toggleSpeaker() {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (audioRef.current) {
        audioRef.current.muted = next;
        audioRef.current.volume = next ? 0 : 1;
      }
      return next;
    });
  }

  function toggleMic() {
    const recognition = recognitionRef.current;
    setMicMuted((prev) => {
      const next = !prev;
      micMutedRef.current = next;
      if (next) {
        if (recognition && isRecordingRef.current) {
          try {
            recognition.stop();
            setIsRecordingState(false);
          } catch (err) {
            console.error("Error stopping recognition on mic mute:", err);
          }
        }
      } else {
        ensureMicActive();
      }
      return next;
    });
  }

  const suggestions = useMemo(
    () => [
      "Dame un resumen rápido",
      "Repregunta si necesitas detalles",
      "Activa modo breve con respuestas de 2 frases",
    ],
    []
  );

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden"
      style={{ backgroundImage: labTheme.gradients.canvas }}
    >
      <div className="flex h-screen overflow-hidden">
        <aside
          className="relative hidden h-full flex-col border-r border-white/5 bg-black/30 backdrop-blur-xl transition-[width] duration-300 md:flex"
          style={{ width: sidebarCollapsed ? 84 : 280 }}
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
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Tablero
                </p>
                <p className="text-lg font-semibold text-white">Voice Agent</p>
              </div>
            )}
            <button
              className={`ml-auto flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 ${
                sidebarCollapsed ? "w-10 px-0" : ""
              }`}
              type="button"
              title="Nuevo chat"
            >
              <Plus className="h-4 w-4" />
              {!sidebarCollapsed && <span className="ml-2">Nuevo chat</span>}
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

        <div className="flex flex-1 flex-col min-w-0 bg-black/30 backdrop-blur-xl">
          <header
            className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-transparent px-4 py-3 transition-colors sm:px-6 md:px-2 ${
              showHeaderDivider ? "border-white/10" : "border-transparent"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="flex items-center justify-center bg-transparent text-white transition md:hidden"
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
                  return isAssistant ? (
                    <div key={message.id} className="space-y-2 px-1">
                      <p className="text-base leading-relaxed text-slate-100">
                        {message.text}
                      </p>
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
                            <AudioLines className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
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
                        void sendUserMessage(input);
                      }
                    }}
                    disabled={!wsConnected}
                  />
                  <button
                    onClick={() => {
                      if (hasTypedInput) {
                        void sendUserMessage(input);
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
