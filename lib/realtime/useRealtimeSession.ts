import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  VoiceMessage,
  CallStatus,
  ScopeDefinition,
  VoiceSessionStore,
  VoiceSessionActions,
} from "./realtimeTypes";
import { useRealtimeTransport } from "./useRealtimeTransport";
import { usePlaybackQueue } from "./usePlaybackQueue";
import { useTranscriptionIntent } from "./useTranscriptionIntent";
import { useAudioIn } from "./useAudioIn";

export type {
  VoiceMessage,
  CallStatus,
  ScopeDefinition,
  VoiceSessionStore,
} from "./realtimeTypes";

type UseRealtimeSessionOptions = {
  startCallPrompt?: string;
  initialScope?: string;
  wsUrl?: string;
  connectionKey?: string;
  meta?: Record<string, unknown>;
  conversationId?: string | null;
  assistantId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  // Called whenever the Realtime API finishes an assistant turn and we
  // have a stable transcript for that reply. Useful for persistence.
  onAssistantTurnFinal?: (text: string) => void;
};

const ASSISTANT_PLAYBACK_RATE =
  Number(process.env.NEXT_PUBLIC_ASSISTANT_PLAYBACK_RATE ?? "1.05");
// Visual typing cadence for streaming deltas (word-paced to feel like subtitles).
const ASSISTANT_WORD_BASE_MS = 180;
const ASSISTANT_WORD_PER_CHAR_MS = 22;
const ASSISTANT_WORD_MIN_MS = 160;
const ASSISTANT_WORD_MAX_MS = 450;
const VAD_VOICE_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_VAD_VOICE_THRESHOLD ?? "0.008"
);
const VAD_SILENCE_MS = Number(
  process.env.NEXT_PUBLIC_VAD_SILENCE_MS ?? "500"
);

// Multiplier applied over the estimated noise floor to decide
// when an RMS value is considered "voice". Higher values make
// the detector more conservative (less sensitive to background).
const VAD_NOISE_FACTOR = Number(
  process.env.NEXT_PUBLIC_VAD_NOISE_FACTOR ?? "2.5"
);

// Minimum amount of continuous detected voice (in ms) required
// before we treat it as a true barge-in that should interrupt
// the assistant. This prevents tiny "mm"/keyboard spikes from
// immediately cancelling the current response.
const BARGE_IN_MIN_MS = Number(
  process.env.NEXT_PUBLIC_BARGE_IN_MIN_MS ?? "220"
);

// When false, the assistant runs in "pure voice" mode:
// - user voice utterances are not sent through /api/transcribe
//   or /api/voice-intent
// - no user chat bubbles are created from voice
// - Realtime still consumes audio directly via the bridge
//   and handles reasoning + tools.
const USE_VOICE_TRANSCRIBE =
  process.env.NEXT_PUBLIC_USE_VOICE_TRANSCRIBE !== "false";

// Minimum number of PCM16 samples required to treat a detected
// voice segment as a real utterance to transcribe. At 24kHz,
// 2400 samples ≈ 100ms of audio.
const MIN_UTTERANCE_SAMPLES = 2400;

const DEFAULT_SCOPE_RULES: ScopeDefinition[] = [];

export function useRealtimeSession(
  options: UseRealtimeSessionOptions = {}
) {
  const {
    startCallPrompt = "",
    initialScope = "support",
    wsUrl = "ws://localhost:4001",
    connectionKey,
    onAssistantTurnFinal,
  } = options;

  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [inCall, setInCall] = useState(false);
  const [assistantTalking, setAssistantTalking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [scopes, setScopes] = useState<ScopeDefinition[]>([]);
  const [currentScope, setCurrentScope] = useState<string>(initialScope);

  const wsRef = useRef<WebSocket | null>(null);
  const userUtteranceChunksRef = useRef<Int16Array[]>([]);
  const userUtteranceActiveRef = useRef(false);
  const userUtteranceLastVoiceMsRef = useRef<number | null>(null);
  const userUtteranceFirstVoiceMsRef = useRef<number | null>(null);
  const hasSentAudioRef = useRef(false);
  const currentUserUtteranceIdRef = useRef<string | null>(null);

  const inCallRef = useRef(false);
  const mutedRef = useRef(false);
  const micMutedRef = useRef(false);
  const assistantTalkingRef = useRef(false);
  const currentResponseIdRef = useRef<string | null>(null);
  const currentAssistantTextRef = useRef("");
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantDeltaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const assistantDeltaBufferRef = useRef("");
  const assistantWordQueueRef = useRef<string[]>([]);
  const assistantPlaceholderRef = useRef(false);
  const pendingAssistantTextRef = useRef<string | null>(null);
  const lastFinalResponseIdRef = useRef<string | null>(null);
  const lastFinalTextRef = useRef("");
  const dropAssistantResponsesRef = useRef(false);
  const dropAssistantAudioRef = useRef(false);
  // When true, we suppress audio playback (text-only chat mode).
  const textOnlyRef = useRef(true);
  const introPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserTurnAtRef = useRef<number | null>(null);
  const wsConnectedRef = useRef(false);
  const conversationIdRef = useRef<string | null>(options?.conversationId ?? null);
  const assistantIdRef = useRef<string | null>(options?.assistantId ?? null);
  const userIdRef = useRef<string | null>(options?.userId ?? null);
  const workspaceIdRef = useRef<string | null>(options?.workspaceId ?? null);
  const onAssistantTurnFinalRef = useRef<
    ((text: string) => void) | undefined
  >(onAssistantTurnFinal);

  const {
    muted,
    setMuted: setPlaybackMuted,
    handleIncomingAudioChunk: enqueueAssistantAudio,
    interruptAssistantAudio,
  } = usePlaybackQueue({
    playbackRate: ASSISTANT_PLAYBACK_RATE,
    initialMuted: false,
    onStartTalking: () => {
      if (textOnlyRef.current) return;
      assistantTalkingRef.current = true;
      setAssistantTalking(true);
    },
    onStopTalking: () => {
      if (textOnlyRef.current) return;
      assistantTalkingRef.current = false;
      setAssistantTalking(false);
    },
  });

  useEffect(() => {
    onAssistantTurnFinalRef.current = onAssistantTurnFinal;
  }, [onAssistantTurnFinal]);

  useEffect(() => {
    conversationIdRef.current = options?.conversationId ?? null;
  }, [options?.conversationId]);

  useEffect(() => {
    assistantIdRef.current = options?.assistantId ?? null;
  }, [options?.assistantId]);

  useEffect(() => {
    userIdRef.current = options?.userId ?? null;
  }, [options?.userId]);

  useEffect(() => {
    workspaceIdRef.current = options?.workspaceId ?? null;
  }, [options?.workspaceId]);

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

  const { transcribeUserUtterance, autoDetectScope } = useTranscriptionIntent({
    useVoiceTranscribe: USE_VOICE_TRANSCRIBE,
    minUtteranceSamples: MIN_UTTERANCE_SAMPLES,
    currentScope,
    setCurrentScope,
    setMessages,
    pushSystem,
  });

  const handleUtteranceComplete = useCallback(
    async (
      pcm16: Int16Array,
      messageId?: string,
      meta?: { duringAssistant?: boolean }
    ) => {
      if (!inCallRef.current) return;

      dropAssistantResponsesRef.current = false;
      dropAssistantAudioRef.current = false;

      if (assistantTalkingRef.current && meta?.duringAssistant) {
        interruptAssistant();
      }

      const nowTs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      lastUserTurnAtRef.current = nowTs;

      const result = await transcribeUserUtterance(pcm16, {
        messageId: messageId ?? null,
        scopeCatalog,
      });
      const transcript = (result?.transcript || "").trim();

      if (!transcript || !inCallRef.current) {
        return;
      }

      const scoped = result?.nextScope;
      const detectedScope = await autoDetectScope(transcript, scopeCatalog);
      const finalScope = scoped || detectedScope || currentScope;

      if (USE_VOICE_TRANSCRIBE) {
        if (messageId) {
          setMessages((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i -= 1) {
              if (updated[i].id === messageId) {
                updated[i] = { ...updated[i], text: transcript };
                return updated;
              }
            }
            return [
              ...updated,
              { id: crypto.randomUUID(), from: "user", text: transcript },
            ];
          });
        } else {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), from: "user", text: transcript },
          ]);
        }
      } else if (messageId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }

      if (finalScope && finalScope !== currentScope) {
        setCurrentScope(finalScope);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "user_voice_transcript",
            text: transcript,
            scope: finalScope || currentScope,
            conversationId: conversationIdRef.current || undefined,
            assistantId: assistantIdRef.current || undefined,
            meta: {
              turnType: "user_voice",
              scope: finalScope || currentScope,
              inputMode: "voice",
              outputMode: "text",
              bargeIn: false,
              mode: "voice",
              userId: userIdRef.current || undefined,
              workspaceId: workspaceIdRef.current || undefined,
            },
          })
        );
      }
    },
    [
      autoDetectScope,
      currentScope,
      scopeCatalog,
      transcribeUserUtterance,
    ]
  );

  const { startAudioStreaming, stopAudioStreaming, resetUtteranceTracking } =
    useAudioIn({
      wsRef,
      inCallRef,
      micMutedRef,
      assistantTalkingRef,
      hasSentAudioRef,
      dropAssistantResponsesRef,
      dropAssistantAudioRef,
      userUtteranceChunksRef,
      userUtteranceActiveRef,
      userUtteranceLastVoiceMsRef,
      userUtteranceFirstVoiceMsRef,
      currentUserUtteranceIdRef,
      setMessages,
      minUtteranceSamples: MIN_UTTERANCE_SAMPLES,
      vadVoiceThreshold: VAD_VOICE_THRESHOLD,
      vadNoiseFactor: VAD_NOISE_FACTOR,
      vadSilenceMs: VAD_SILENCE_MS,
      bargeInMinMs: BARGE_IN_MIN_MS,
      useVoiceTranscribe: USE_VOICE_TRANSCRIBE,
      onUtteranceComplete: handleUtteranceComplete,
      onBargeIn: () => {
        interruptAssistant();
      },
    });

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
    inCallRef.current = inCall;
  }, [inCall]);

  useEffect(() => {
    wsConnectedRef.current = wsConnected;
  }, [wsConnected]);
  useEffect(() => {
    conversationIdRef.current = options?.conversationId ?? null;
  }, [options?.conversationId]);
  useEffect(() => {
    assistantIdRef.current = options?.assistantId ?? null;
  }, [options?.assistantId]);
  useEffect(() => {
    userIdRef.current = options?.userId ?? null;
  }, [options?.userId]);
  useEffect(() => {
    workspaceIdRef.current = options?.workspaceId ?? null;
  }, [options?.workspaceId]);

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
    return () => {
      if (introPromptTimeoutRef.current) {
        clearTimeout(introPromptTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  function handleBridgeMessage(data: any) {
    const currentResponseId = currentResponseIdRef.current;
    const eventResponseId = data.response_id || data.response?.id || data.id;

    const shouldAcceptAssistantContent = (): boolean => {
      if (dropAssistantResponsesRef.current) return false;
      if (!currentResponseId) return false;
      if (eventResponseId && eventResponseId !== currentResponseId) return false;
      return true;
    };

    const appendAssistantText = (delta: string) => {
      if (!delta) return;
      if (!shouldAcceptAssistantContent()) return;
      ensureAssistantMessage();
      assistantDeltaBufferRef.current += delta;

      // Move complete words from buffer into a queue to pace them out.
      const tokens = assistantDeltaBufferRef.current.split(/(\s+)/);
      assistantDeltaBufferRef.current = "";
      for (const token of tokens) {
        if (!token) continue;
        // Keep spaces as their own token to preserve natural spacing.
        assistantWordQueueRef.current.push(token);
      }

      if (!assistantDeltaTimerRef.current) {
        const pump = () => {
          if (!assistantWordQueueRef.current.length) {
            assistantDeltaTimerRef.current = null;
            return;
          }
          const chunk = assistantWordQueueRef.current.shift() ?? "";
          const next = currentAssistantTextRef.current + chunk;
          currentAssistantTextRef.current = next;
          setLastAssistantText(next);
          const wordLen = chunk.trim().length;
          const nextDelay = Math.max(
            ASSISTANT_WORD_MIN_MS,
            Math.min(
              ASSISTANT_WORD_MAX_MS,
              ASSISTANT_WORD_BASE_MS +
                ASSISTANT_WORD_PER_CHAR_MS * Math.max(1, wordLen)
            )
          );
          assistantDeltaTimerRef.current = setTimeout(
            pump,
            nextDelay
          );
        };
        assistantDeltaTimerRef.current = setTimeout(
          pump,
          ASSISTANT_WORD_BASE_MS
        );
      }
    };

    if (data.type === "ui.command") {
      handleUiCommand(String(data.command || ""), data.args);
      return;
    }

    if (data.type === "response.text.delta") {
      return;
    }

    if (data.type === "response.audio_transcript.delta") {
      appendAssistantText(data.delta ?? "");
      return;
    }

    if (data.type === "response.created") {
      const id = data.response?.id || data.id;
      if (id) {
        currentResponseIdRef.current = id;
      }
      // New assistant turn: allow a fresh message bubble.
      currentAssistantMessageIdRef.current = null;
      assistantDeltaBufferRef.current = "";
      if (assistantDeltaTimerRef.current) {
        clearTimeout(assistantDeltaTimerRef.current);
        assistantDeltaTimerRef.current = null;
      }
      lastFinalResponseIdRef.current = null;
      lastFinalTextRef.current = "";
      if (!USE_VOICE_TRANSCRIBE) {
        dropAssistantResponsesRef.current = false;
        dropAssistantAudioRef.current = false;
      }
      currentAssistantTextRef.current = "";
      pendingAssistantTextRef.current = null;
      setLoading(false);
    }

    if (data.type === "response.audio.delta") {
      setLoading(false);
    }

    if (data.type === "response.text.done") {
      return;
    }

    if (data.type === "response.audio_transcript.done") {
      const finalText: string =
        (data.transcript as string) ??
        (data.text as string) ??
        currentAssistantTextRef.current;
      const currentText = currentAssistantTextRef.current;
      const sameAsCurrent =
        finalText.trim() === currentText.trim() && finalText.length > 0;
      const alreadySeenText = lastFinalTextRef.current === finalText;
      const alreadySeenId =
        eventResponseId &&
        lastFinalResponseIdRef.current === eventResponseId &&
        lastFinalTextRef.current === finalText;
      if (alreadySeenId || alreadySeenText) {
        return;
      }
      if (!shouldAcceptAssistantContent() || !finalText) {
        currentAssistantTextRef.current = "";
        pendingAssistantTextRef.current = null;
        assistantDeltaBufferRef.current = "";
        assistantWordQueueRef.current = [];
        if (assistantDeltaTimerRef.current) {
          clearTimeout(assistantDeltaTimerRef.current);
          assistantDeltaTimerRef.current = null;
        }
        return;
      }
      if (sameAsCurrent) {
        assistantDeltaBufferRef.current = "";
        assistantWordQueueRef.current = [];
        if (assistantDeltaTimerRef.current) {
          clearTimeout(assistantDeltaTimerRef.current);
          assistantDeltaTimerRef.current = null;
        }
        pendingAssistantTextRef.current = null;
        return;
      }
      // On final text, snap to the authoritative string to avoid dupes.
      assistantDeltaBufferRef.current = "";
      assistantWordQueueRef.current = [];
      if (assistantDeltaTimerRef.current) {
        clearTimeout(assistantDeltaTimerRef.current);
        assistantDeltaTimerRef.current = null;
      }
      stopTypingAnimation();
      ensureAssistantMessage();
      currentAssistantTextRef.current = finalText;
      setLastAssistantText(finalText);
      lastFinalResponseIdRef.current = eventResponseId ?? null;
      lastFinalTextRef.current = finalText;
      pendingAssistantTextRef.current = null;
    }

    if (data.type === "conversation.item.created") {
      setLoading(false);
    }

    if (data.type === "tool.log") {
      const status: string = data.status ?? "";
      const args = data.args || {};
      pushSystem(
        `Tool ${data.name || "unknown"}: ${status}${
          args && Object.keys(args).length ? " (args captured)" : ""
        }`,
        status === "failed" ? "error" : "info"
      );
    }

    if (data.type === "error" && data.message) {
      pushSystem(`Bridge error: ${data.message}`, "error");
    }

    setLoading(false);
  }

  function pushSystem(text: string, meta?: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), from: "system", text, meta },
    ]);
  }

  useRealtimeTransport({
    wsUrl,
    connectionKey,
    onJsonMessage: handleBridgeMessage,
    onBinaryMessage: (buffer: ArrayBuffer) => {
      if (textOnlyRef.current) return;
      enqueueAssistantAudio(buffer, dropAssistantAudioRef.current);
      setLoading(false);
    },
    pushSystem,
    setCallStatus,
    wsRef,
    reconnectTimeoutRef,
    wsConnectedRef,
    setWsConnected,
  });

  function ensureAssistantMessage() {
    const id = currentAssistantMessageIdRef.current ?? crypto.randomUUID();
    currentAssistantMessageIdRef.current = id;
    assistantPlaceholderRef.current = true;
    setMessages((prev) => {
      if (prev.some((m) => m.id === id)) return prev;
      return [...prev, { id, from: "assistant", text: "" }];
    });
  }

  function setLastAssistantText(nextText: string) {
    const id = currentAssistantMessageIdRef.current ?? crypto.randomUUID();
    currentAssistantMessageIdRef.current = id;
    setMessages((prev) => {
      let found = false;
      const updated = prev.map((m) => {
        if (m.id === id) {
          found = true;
          return { ...m, text: nextText };
        }
        return m;
      });
      if (!found) {
        updated.push({ id, from: "assistant", text: nextText });
      }
      return updated;
    });
  }

  function stopTypingAnimation() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    assistantPlaceholderRef.current = false;
    // Also stop any paced delta rendering.
    assistantDeltaBufferRef.current = "";
    assistantWordQueueRef.current = [];
    if (assistantDeltaTimerRef.current) {
      clearTimeout(assistantDeltaTimerRef.current);
      assistantDeltaTimerRef.current = null;
    }
  }

  function startAssistantTyping(fullText: string, initialDelay = 350) {
    stopTypingAnimation();
    if (!fullText) {
      return;
    }
    ensureAssistantMessage();
    setLastAssistantText("");
    // Typing speed tuned to feel natural and stay roughly
    // aligned with spoken audio without racing ahead.
    const baseOverhead = 300;
    const perChar = 14;
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

  function interruptAssistant() {
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

    interruptAssistantAudio();

    dropAssistantResponsesRef.current = true;
    currentAssistantTextRef.current = "";
    pendingAssistantTextRef.current = null;

    // Treat the next assistant response as a fresh turn in the UI
    // so we don't concatenate a new answer onto a partially
    // interrupted previous one.
    assistantPlaceholderRef.current = false;

    assistantTalkingRef.current = false;
    setAssistantTalking(false);
  }

  async function sendUserMessage(
    text: string,
    options?: {
      silent?: boolean;
      conversationId?: string | null;
      assistantId?: string | null;
      meta?: Record<string, unknown>;
    }
  ) {
    const trimmed = text.trim();
    if (
      !trimmed ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    // Ensure assistant audio/text are accepted for this new turn,
    // even if the previous response was interrupted.
    dropAssistantResponsesRef.current = false;
    dropAssistantAudioRef.current = false;

    if (assistantTalkingRef.current) {
      interruptAssistant();
    }

    const nowTs =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    lastUserTurnAtRef.current = nowTs;

    let scopeForMessage = currentScope;
    if (!options?.silent) {
      scopeForMessage = await autoDetectScope(trimmed, scopeCatalog);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from: "user", text: trimmed },
      ]);
    }
    setLoading(true);

    const payload: {
      type: "user_message";
      text: string;
      scope: string;
      conversationId?: string;
      assistantId?: string;
      meta?: Record<string, unknown>;
    } = {
      type: "user_message",
      text: trimmed,
      scope: scopeForMessage,
      meta: options?.meta,
    };

    if (options?.conversationId) {
      payload.conversationId = options.conversationId;
    }
    if (options?.assistantId) {
      payload.assistantId = options.assistantId;
    }

    wsRef.current.send(JSON.stringify(payload));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    await sendUserMessage(input);
    setInput("");
  }

  function playAudioAsset(src: string) {
    try {
      const audio = new Audio(src);
      audio.volume = 1.0;
      void audio.play();
    } catch (err) {
      console.warn("Audio asset playback failed:", err);
    }
  }

  function playCue(type: "start" | "end" | "tool") {
    // For tool events, prefer the custom audio asset if available.
    if (type === "tool") {
      playAudioAsset("/tool-loading.mp3");
      return;
    }
    try {
      const AudioContextCtor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      if (type === "start") {
        oscillator.frequency.value = 880;
        gain.gain.value = 0.22;
      } else if (type === "end") {
        oscillator.frequency.value = 440;
        gain.gain.value = 0.18;
      } else {
        // Tool cue: short, softer blip to indicate that
        // the assistant is performing a background action.
        oscillator.frequency.value = 680;
        gain.gain.value = 0.16;
      }
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      oscillator.onended = () => ctx.close();
    } catch (err) {
      console.warn("Audio cue failed:", err);
    }
  }

  function startCall() {
    if (!wsConnected) {
      alert("Realtime server not connected");
      return;
    }

    dropAssistantResponsesRef.current = false;
    dropAssistantAudioRef.current = false;
    // Switch to full duplex (allow assistant audio) for the call.
    textOnlyRef.current = false;
    inCallRef.current = true;
    setInCall(true);
    setCallStatus("calling");
    pushSystem("Launching voice session…", "call");
    playCue("start");
    void startAudioStreaming();

    if (introPromptTimeoutRef.current) {
      clearTimeout(introPromptTimeoutRef.current);
    }
    introPromptTimeoutRef.current = setTimeout(() => {
      if (!inCallRef.current) return;
      setCallStatus("in_call");
      pushSystem("Call established", "success");
      // We no longer send an automatic text prompt at call
      // start; the profile instructions govern how the
      // assistant greets the user once they actually speak.
    }, 500);
  }

  function endCall() {
    inCallRef.current = false;
    setInCall(false);
    setCallStatus("idle");
    setPlaybackMuted(false);
    setMicMuted(false);
    resetUtteranceTracking();
    // Clear any in-progress user utterance so a dangling
    // placeholder ("…") dot does not remain after hangup.
    userUtteranceActiveRef.current = false;
    userUtteranceChunksRef.current = [];
    userUtteranceLastVoiceMsRef.current = null;
    if (currentUserUtteranceIdRef.current) {
      const pendingId = currentUserUtteranceIdRef.current;
      currentUserUtteranceIdRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
    }
    // As an extra safety net, remove any remaining
    // placeholder user messages ("…") that may have
    // been created for utterances whose transcription
    // was cancelled by the hangup.
    setMessages((prev) =>
      prev.filter(
        (m) => !(m.from === "user" && m.text === "…")
      )
    );
    interruptAssistant();
    // After a call ends, drop any late assistant audio chunks.
    dropAssistantAudioRef.current = true;
    // Return to text-only mode for chat sessions.
    textOnlyRef.current = true;
    pendingAssistantTextRef.current = null;
    currentAssistantTextRef.current = "";
    currentAssistantMessageIdRef.current = null;
    assistantDeltaBufferRef.current = "";
    assistantWordQueueRef.current = [];
    lastFinalResponseIdRef.current = null;
    lastFinalTextRef.current = "";
    if (assistantDeltaTimerRef.current) {
      clearTimeout(assistantDeltaTimerRef.current);
      assistantDeltaTimerRef.current = null;
    }
    stopTypingAnimation();
    dropAssistantResponsesRef.current = true;
    setLoading(false);
    pushSystem("Call terminated", "call");
    playCue("end");

    stopAudioStreaming();

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

    if (introPromptTimeoutRef.current) {
      clearTimeout(introPromptTimeoutRef.current);
      introPromptTimeoutRef.current = null;
    }
  }

  function toggleSpeaker() {
    const next = !muted;
    setPlaybackMuted(next);
  }

  function toggleMic() {
    setMicMuted((prev) => {
      const next = !prev;
      micMutedRef.current = next;
      return next;
    });
  }

  const sessionActive = callStatus !== "idle";
  const canStartCall = wsConnected && !sessionActive;
  const sendDisabled = input.trim()
    ? !wsConnected
    : sessionActive
    ? false
    : !canStartCall;
  const isRecording = inCall && !micMuted;

  const store: VoiceSessionStore = {
    messages,
    input,
    loading,
    wsConnected,
    callStatus,
    inCall,
    assistantTalking,
    isRecording,
    muted,
    micMuted,
    currentScope,
    scopes,
    sessionActive,
    canStartCall,
    sendDisabled,
  };

  const actions: VoiceSessionActions = {
    setInput,
    setMessages,
    startCall,
    endCall,
    toggleSpeaker,
    toggleMic,
    handleSubmit,
    sendUserMessage,
  };

  function handleUiCommand(command: string, args: any) {
    switch (command) {
      case "end_call":
        endCall();
        break;
      case "mute_speaker":
        {
          // Only honor mute_speaker if it follows a recent
          // user turn; this avoids accidental or spurious
          // tool invocations when there was no clear user
          // request to mute the voice.
          const nowTs =
            typeof performance !== "undefined" && typeof performance.now === "function"
              ? performance.now()
              : Date.now();
          const lastUser = lastUserTurnAtRef.current;
          const MAX_LAG_MS = 5000;
          if (!lastUser || nowTs - lastUser > MAX_LAG_MS) {
            pushSystem?.(
              "Ignoring unexpected mute_speaker tool (no recent user request).",
              "tool"
            );
            break;
          }
        // Force speaker muted, regardless of current state.
        setPlaybackMuted(true);
        mutedRef.current = true;
        // Speaker mute is a local UI concern; text responses
        // should still be rendered in the chat. Ensure we are
        // not dropping assistant output, only silencing audio.
        dropAssistantResponsesRef.current = false;
        dropAssistantAudioRef.current = false;
        }
        break;
      case "unmute_speaker":
        // Force speaker unmuted, regardless of current state.
        setPlaybackMuted(false);
        mutedRef.current = false;
        // Ensure future assistant responses are accepted and
        // both text and audio can flow normally again.
        dropAssistantResponsesRef.current = false;
        dropAssistantAudioRef.current = false;
        break;
      case "mute_mic":
        // Force mic muted, regardless of current state.
        setMicMuted(true);
        micMutedRef.current = true;
        break;
      case "unmute_mic":
        // Force mic unmuted, regardless of current state.
        setMicMuted(false);
        micMutedRef.current = false;
        break;
      case "set_voice":
        // Voice changes are applied server-side via session.update.
        // Optionally, we could surface a system message here:
        // pushSystem?.(`Changing voice to ${args?.voice}`, "voice");
        break;
      default:
        break;
    }
  }

  return {
    store,
    actions,
    // state
    messages,
    input,
    loading,
    wsConnected,
    callStatus,
    inCall,
    assistantTalking,
    isRecording,
    muted,
    micMuted,
    currentScope,
    scopes,
    sessionActive,
    canStartCall,
    sendDisabled,

    // setters / handlers
    setInput,
    setMessages,
    startCall,
    endCall,
    toggleSpeaker,
    toggleMic,
    handleSubmit,
    sendUserMessage,
  };
}
