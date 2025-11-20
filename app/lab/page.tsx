"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Phone, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import sanitizeRules from "@/config/sanitization-rules.json";
import toolsConfig from "@/config/tools.json";
import assistantProfile from "@/config/assistant-profile.json";
import { labTheme } from "@/lib/theme";

type ChatMessage = {
  id: string;
  from: "user" | "assistant" | "system";
  text: string;
  meta?: string;
};

const START_CALL_PROMPT =
  "Start a voice assistant conversation in Spanish. Lead with a short greeting and ask how you can help.";
type ScopeDefinition = {
  name: string;
  keywords: string[];
};

const DEFAULT_SCOPE_RULES: ScopeDefinition[] = [];

export default function LabPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "in_call">(
    "idle"
  );
  const [inCall, setInCall] = useState(false);
  const [assistantTalking, setAssistantTalking] = useState(false);
  const [isRecording, setIsRecordingState] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [scopes, setScopes] = useState<ScopeDefinition[]>([]);
  const [currentScope, setCurrentScope] = useState<string>("support");
  const [sanitizeModalOpen, setSanitizeModalOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const hasTypedInput = input.trim().length > 0;
  const sessionActive = callStatus !== "idle";
  const canStartCall = wsConnected && !sessionActive;
  const sendDisabled = hasTypedInput
    ? !wsConnected
    : sessionActive
    ? false
    : !canStartCall;

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);

  const inCallRef = useRef(false);
  const mutedRef = useRef(false);
  const micMutedRef = useRef(false);
  const assistantTalkingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const currentResponseIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAssistantTextRef = useRef("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantPlaceholderRef = useRef(false);
  const pendingAssistantTextRef = useRef<string | null>(null);
  const dropAssistantResponsesRef = useRef(false);
  const introPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = muted ? 0 : 1;
    }
  }, [muted]);

  const setIsRecording = (value: boolean) => {
    isRecordingRef.current = value;
    setIsRecordingState(value);
  };
  const sanitizationList = (sanitizeRules as Array<{
    description: string;
    pattern: string;
    replacement?: string;
  }>) ?? [];
  const toolsList =
    ((toolsConfig as { tools?: Array<{ name: string; description: string }> })
      .tools ?? []);
  const profileBlocks = Object.entries(assistantProfile || {});
  const scopeCatalog = useMemo(() => {
    const merged = new Map<string, Set<string>>();
    DEFAULT_SCOPE_RULES.forEach((scope) => {
      const keywords = new Set<string>(
        scope.keywords.map((kw) => kw.toLowerCase())
      );
      keywords.add(scope.name.toLowerCase());
      merged.set(scope.name, keywords);
    });
    scopes.forEach((scope) => {
      const incoming = new Set<string>(
        (scope.keywords || []).map((kw) => kw.toLowerCase())
      );
      incoming.add(scope.name.toLowerCase());
      if (!merged.has(scope.name)) {
        merged.set(scope.name, incoming);
      } else {
        const existing = merged.get(scope.name)!;
        incoming.forEach((kw) => existing.add(kw));
      }
    });
    return Array.from(merged.entries()).map(([name, keywords]) => ({
      name,
      keywords: Array.from(keywords),
    }));
  }, [scopes]);

  const ensureMicActive = () => {
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
      setIsRecording(true);
    } catch (err: any) {
      if (err?.name === "InvalidStateError") {
        setIsRecording(true);
      } else {
        console.error("Error starting recognition:", err);
      }
    }
  };

  useEffect(() => {
    async function loadScopes() {
      try {
        const res = await fetch("/api/scopes");
        const data = await res.json();
        if (Array.isArray(data.scopes)) {
          setScopes(
            data.scopes.map((scope: ScopeDefinition) => ({
              name: scope.name,
              keywords: scope.keywords || [],
            }))
          );
        }
      } catch (err) {
        console.warn("Failed to load scopes:", err);
      }
    }
    loadScopes();
  }, []);

  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  useEffect(() => {
    assistantTalkingRef.current = assistantTalking;
  }, [assistantTalking]);

  useEffect(() => {
    return () => {
      if (introPromptTimeoutRef.current) {
        clearTimeout(introPromptTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ------- Audio playback coordinating with microphone -------
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
      setIsRecording(false);
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

  // ------- WebSocket Realtime connection -------
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
        pushSystem("Realtime WebSocket connected", "link");
      };

      ws.onclose = () => {
        if (didUnmount) return;
        setWsConnected(false);
        pushSystem("Realtime WebSocket disconnected", "warning");
        setCallStatus("idle");
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        if (didUnmount) return;
        console.error("WS error:", err);
        pushSystem("WebSocket error, check console", "error");
        try {
          ws.close();
        } catch {
          // ignore additional close errors
        }
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
              inCallRef.current &&
              !mutedRef.current &&
              typeof data.text === "string";

            if (shouldSpeak) {
              void speak(data.text, () => flushPendingAssistantText(120));
            } else {
              flushPendingAssistantText(80);
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
              "Realtime error received (check server logs)";
            console.error("Realtime error event:", data);
            pushSystem(message, "error");
            setLoading(false);
          }

          if (data.type === "tool.log") {
            const details =
              data.status === "failed" && data.message
                ? `${data.name} (${data.status}): ${data.message}`
                : `${data.name} (${data.status})`;
            pushSystem(`Tool invoked: ${details}`, "tool");
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
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

  function appendAssistantDelta(delta: string) {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.from === "assistant") {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: last.text + delta,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: "assistant",
          text: delta,
        },
      ];
    });
  }

  // ------- Speech recognition setup -------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not available in this browser");
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
        // Chrome often throws "no-speech" when stopped manually;
        // avoid forcing a restart to prevent loops.
        return;
      }
      if (error === "network") {
        console.warn("SpeechRecognition warning: network issue");
        ensureMicActive();
        return;
      }
      console.error("SpeechRecognition error:", error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (micMutedRef.current || assistantTalkingRef.current || !inCallRef.current) {
        setIsRecording(false);
        return;
      }
      ensureMicActive();
    };

    recognitionRef.current = recognition;
  }, []);

  // ------- Helper to push system logs -------
  function pushSystem(text: string, meta?: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), from: "system", text, meta },
    ]);
  }

  // ------- Send message -------
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

    let scopeForMessage = currentScope;
    if (!options?.silent) {
      scopeForMessage = await autoDetectScope(trimmed);
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
        scope: scopeForMessage,
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    await sendUserMessage(input);
    setInput("");
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

  async function autoDetectScope(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return currentScope;
    }
    const vectorScope = await detectScopeViaVectors(trimmed);
    let nextScope = vectorScope;
    if (!nextScope) {
      nextScope = fallbackScopeDetection(trimmed);
    }
    if (!nextScope) {
      return currentScope;
    }
    if (nextScope !== currentScope) {
      setCurrentScope(nextScope);
      pushSystem(`Scope auto-detected: ${nextScope}`, "scope");
    }
    return nextScope;
  }

  async function detectScopeViaVectors(text: string) {
    try {
      const res = await fetch("/api/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.scope === "string" ? data.scope : null;
    } catch (err) {
      console.warn("Scope detection via vectors failed:", err);
      return null;
    }
  }

  function fallbackScopeDetection(text: string) {
    const lower = text.toLowerCase();
    for (const rule of scopeCatalog) {
      if (rule.keywords.some((kw) => kw && lower.includes(kw))) {
        return rule.name;
      }
    }
    return null;
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

function startAssistantTyping(fullText: string, initialDelay = 350) {
  stopTypingAnimation();
  if (!fullText) {
    return;
  }
  ensureAssistantMessage();
  setLastAssistantText("");
  const baseOverhead = 600;
  const perChar = 22;
  const targetDuration = baseOverhead + perChar * fullText.length;
  const delay = Math.max(
    12,
    Math.min(80, targetDuration / Math.max(1, fullText.length))
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

function flushPendingAssistantText(delay = 200) {
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

  // ------- Call controls -------
  function startCall() {
    if (!wsConnected) {
      alert("Realtime server not connected");
      return;
    }

    dropAssistantResponsesRef.current = false;
    setInCall(true);
    setCallStatus("calling");
    pushSystem("Launching voice session…", "call");
    playCue("start");

    ensureMicActive();

    if (introPromptTimeoutRef.current) {
      clearTimeout(introPromptTimeoutRef.current);
    }
    introPromptTimeoutRef.current = setTimeout(() => {
      if (!inCallRef.current) return;
      setCallStatus("in_call");
      pushSystem("Call established", "success");
      void sendUserMessage(START_CALL_PROMPT, { silent: true });
    }, 500);
  }

  function endCall() {
    setInCall(false);
    setCallStatus("idle");
    setMuted(false);
    setMicMuted(false);
    setAssistantTalking(false);
    pendingAssistantTextRef.current = null;
    currentAssistantTextRef.current = "";
    stopTypingAnimation();
    dropAssistantResponsesRef.current = true;
    setLoading(false);
    pushSystem("Call terminated", "call");
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
    if (recognition && isRecording) {
      try {
        recognition.stop();
        setIsRecording(false);
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

  function toggleSpeaker() {
    setMuted((prev) => !prev);
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
            setIsRecording(false);
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

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ backgroundImage: labTheme.gradients.canvas }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-stretch">
        {/* Left column: control panel */}
        <section
          className="flex w-full flex-col rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl lg:max-w-sm"
          style={{ borderRadius: labTheme.radii.shell }}
        >
          <header className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Lab Mode
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Voice Agent
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Realtime reasoning, custom policies, and full voice control.
            </p>
          </header>

          <div className="space-y-4 text-sm">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Realtime API WebSocket</span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    wsConnected ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {wsConnected ? "Online" : "Offline"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3 text-slate-200">
                <span
                  className={`h-3 w-3 rounded-full ${
                    wsConnected ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <span className="text-xs font-medium">
                  {wsConnected
                    ? "Streaming ready"
                    : "Waiting for realtime-server"}
                </span>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between text-slate-300">
                <span>Voice session</span>
                <StatusBadge status={callStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-medium text-slate-400">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Mic
                  </p>
                  <p className="mt-1 text-base text-white">
                    {micMuted
                      ? "Muted"
                      : isRecording
                      ? "Listening"
                      : "Idle"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Assistant
                  </p>
                  <p className="mt-1 text-base text-white">
                    {assistantTalking ? "Speaking" : "Ready"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {callStatus === "in_call" ? (
                  <>
                    <button
                      onClick={toggleSpeaker}
                      className={`group flex-1 cursor-pointer rounded-full border px-3.5 py-2.5 transition-all ${
                        muted
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                      }`}
                      title={muted ? "Unmute speaker" : "Mute speaker"}
                    >
                      {muted ? (
                        <VolumeX strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      ) : (
                        <Volume2 strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`group flex-1 cursor-pointer rounded-full border px-3.5 py-2.5 transition-all ${
                        micMuted
                          ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                          : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                      }`}
                      title={micMuted ? "Unmute mic" : "Mute mic"}
                    >
                      {micMuted ? (
                        <MicOff strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      ) : (
                        <Mic strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={endCall}
                      className="group flex-1 cursor-pointer rounded-full border border-rose-500/70 bg-rose-500/20 px-3.5 py-2.5 text-rose-100 hover:bg-rose-500/30"
                      title="End call"
                    >
                      <Phone strokeWidth={1.8} className="mx-auto h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCall}
                    disabled={!wsConnected}
                    className="w-full cursor-pointer rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-100 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  >
                    <span className="flex items-center justify-center gap-2 text-base">
                      <Phone strokeWidth={1.8} className="h-4 w-4" />
                      Voice session
                    </span>
                  </button>
                )}
              </div>
            </Card>

            <Card tone="muted" className="text-xs text-slate-400">
              <p className="mb-2 font-semibold text-slate-200">Session notes</p>
              <ul className="space-y-1">
                <li>• Voice is fully synthetic and auto-muted when the assistant speaks.</li>
                <li>• You can still type while the mic is open.</li>
                <li>• Safety policies and RAG context apply to every reply.</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Right column: conversation + composer */}
        <section
          className="flex flex-1 flex-col rounded-[28px] border border-white/5 bg-slate-950/80"
          style={{
            borderRadius: labTheme.radii.panel,
            boxShadow: labTheme.shadows.panel,
          }}
        >
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
                Lab Mode
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Chat
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <PillButton onClick={() => setScopeModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Scope: {currentScope}
              </PillButton>
              <PillButton onClick={() => setProfileModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Profile
              </PillButton>
              <PillButton onClick={() => setSanitizeModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Sanitized streaming
              </PillButton>
              <PillButton onClick={() => setToolsModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Tools
              </PillButton>
            </div>
          </div>

          <div
            className="h-[460px] space-y-4 overflow-y-auto px-6 py-8"
            ref={chatContainerRef}
          >
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                Awaiting your first prompt. Start the call or type a message to brief
                the assistant.
              </div>
            )}
            {messages.map((message) => (
              <ChatBubble key={message.id} from={message.from} meta={message.meta}>
                {message.text}
              </ChatBubble>
            ))}
            {loading && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Assistant drafting response…
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-white/5 px-6 py-4"
          >
            <div className="flex gap-3">
              <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
                <input
                  type="text"
                  className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  placeholder={
                    callStatus === "in_call"
                      ? "Speak or type additional instructions…"
                      : "Type a prompt for the assistant…"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <button
                type={hasTypedInput ? "submit" : "button"}
                onClick={() => {
                  if (hasTypedInput) return;
                  if (callStatus === "calling") return;
                  if (callStatus === "in_call") {
                    endCall();
                  } else if (callStatus === "idle") {
                    startCall();
                  }
                }}
                disabled={hasTypedInput ? !wsConnected : callStatus === "calling" || !wsConnected}
                className={`flex h-12 w-14 items-center justify-center rounded-2xl border text-base font-semibold transition focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                  hasTypedInput
                    ? "border-white/15 bg-white text-slate-900 hover:bg-slate-100"
                    : callStatus === "in_call"
                    ? "border-rose-500/70 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                    : callStatus === "calling"
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-50"
                    : "border-emerald-400/60 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                }`}
                title={
                  hasTypedInput
                    ? "Send message"
                    : callStatus === "in_call"
                    ? "End call"
                    : callStatus === "calling"
                    ? "Dialing…"
                    : canStartCall
                    ? "Start voice session"
                    : wsConnected
                    ? "Session already active"
                    : "Connect to realtime server"
                }
              >
                {hasTypedInput ? (
                  <ArrowUp strokeWidth={1.8} className="h-5 w-5" />
                ) : (
                  <Phone strokeWidth={1.8} className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
      {sanitizeModalOpen && (
        <Modal title="Sanitization rules" onClose={() => setSanitizeModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            {sanitizationList.map((rule, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">{rule.description}</p>
                <p className="mt-1 text-xs text-slate-300 break-words">
                  Pattern: <code className="text-emerald-200">{rule.pattern}</code>
                </p>
                {rule.replacement && (
                  <p className="text-xs text-slate-400 break-words">
                    Replacement: <code>{rule.replacement}</code>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
      {toolsModalOpen && (
        <Modal title="Enabled tools" onClose={() => setToolsModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            {toolsList.map((tool) => (
              <div
                key={tool.name}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="font-semibold text-white">{tool.name}</p>
                <p className="text-xs text-slate-300">{tool.description}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {profileModalOpen && (
        <Modal title="Assistant profile" onClose={() => setProfileModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            {profileBlocks.map(([key, values]) => (
              <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">
                  {key.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {(Array.isArray(values) ? values : []).map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {scopeModalOpen && (
        <Modal title="Available scopes" onClose={() => setScopeModalOpen(false)}>
          <div className="space-y-2 text-sm text-slate-200">
            {scopeCatalog.map((scope) => (
              <div
                key={scope.name}
                className={`rounded-2xl border px-4 py-2 ${
                  scope.name === currentScope
                    ? "border-emerald-400/60 bg-emerald-500/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-200"
                }`}
              >
                <p className="font-semibold capitalize">{scope.name}</p>
                {scope.keywords.length > 0 && (
                  <p className="text-xs text-slate-400">
                    Keywords: {scope.keywords.join(", ")}
                  </p>
                )}
                {scope.name === currentScope && (
                  <span className="ml-2 text-xs text-emerald-200">(current)</span>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
