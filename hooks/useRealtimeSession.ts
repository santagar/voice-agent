import { useEffect, useMemo, useRef, useState } from "react";
import { useApiSessions } from "./useApiSessions";
import { useApiScopes, ScopeDefinition } from "./useApiScopes";
import { useApiTranscribe } from "./useApiTranscribe";
import { useApiVoiceIntent } from "./useApiVoiceIntent";

export type VoiceMessage = {
  id: string;
  from: "user" | "assistant" | "system";
  text: string;
  meta?: Record<string, unknown> | string | null;
};

export type CallStatus = "idle" | "calling" | "in_call";

type UseRealtimeSessionOptions = {
  startCallPrompt?: string;
  initialScope?: string;
  wsUrl?: string;
  sessionId?: string | null;
  autoConnect?: boolean;
  // Called whenever the Realtime API finishes an assistant turn and we
  // have a stable transcript for that reply. Useful for persistence.
  onAssistantTurnFinal?: (text: string) => void;
  // Called when a user voice utterance is transcribed to text.
  onUserTranscriptFinal?: (text: string) => void;
  // Called when a voice utterance placeholder ("…") is created.
  onUserUtteranceStarted?: () => void;
  // Called when a voice utterance finishes processing (final transcript or dropped).
  onUserUtteranceFinished?: () => void;
  // Called when the WS session is closed (by user or idle timeout) so the caller can
  // persist the session status.
  onSessionClosed?: (status: "closed" | "expired") => void;
};

const ASSISTANT_PLAYBACK_RATE =
  Number(process.env.NEXT_PUBLIC_ASSISTANT_PLAYBACK_RATE ?? "1.05");
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

// Time maximum of inactivity (no messages or audio) before closing the WS.
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

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
    sessionId = null,
    autoConnect = true,
    onAssistantTurnFinal,
    onUserTranscriptFinal,
    onSessionClosed,
  } = options;
  const { onUserUtteranceStarted, onUserUtteranceFinished } = options;

  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [inCall, setInCall] = useState(false);
  const [assistantTalking, setAssistantTalking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [scopes, setScopes] = useState<ScopeDefinition[]>([]);
  const scopesLoadedRef = useRef(false);
  const [currentScope, setCurrentScope] = useState<string>(initialScope);
  const [bridgeConnections, setBridgeConnections] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioPlaybackTimeRef = useRef<number | null>(null);
  const activeAssistantSourcesRef = useRef<
    { source: AudioBufferSourceNode; gain: GainNode }[]
  >([]);
  const noiseFloorRef = useRef(0);
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAssistantTextRef = useRef("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioOutputActiveRef = useRef(false);
  const connectingRef = useRef(false);
  const pendingConnectionRef = useRef<Promise<boolean> | null>(null);
  const closingForIdleRef = useRef(false);
  const sessionClosedNotifiedRef = useRef(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number | null>(null);
  const assistantPlaceholderRef = useRef(false);
  const pendingAssistantTextRef = useRef<string | null>(null);
  const dropAssistantResponsesRef = useRef(false);
  const dropAssistantAudioRef = useRef(false);
  const introPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserTurnAtRef = useRef<number | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const wsConnectedRef = useRef(false);
  const didUnmountRef = useRef(false);
  const { updateSession } = useApiSessions();
  const { transcribe } = useApiTranscribe();
  const { classifyIntent } = useApiVoiceIntent();
  const { listScopes, detectScope } = useApiScopes();
  const onAssistantTurnFinalRef = useRef<
    ((text: string) => void) | undefined
  >(onAssistantTurnFinal);
  const onUserTranscriptFinalRef = useRef<
    ((text: string) => void) | undefined
  >(onUserTranscriptFinal);
  const onUserUtteranceStartedRef = useRef<
    (() => void) | undefined
  >(onUserUtteranceStarted);
  const onUserUtteranceFinishedRef = useRef<
    (() => void) | undefined
  >(onUserUtteranceFinished);

  async function persistSessionStatus(status: "closed" | "expired") {
    if (sessionClosedNotifiedRef.current) return;
    sessionClosedNotifiedRef.current = true;
    if (sessionId) {
      try {
        await updateSession(sessionId, { status });
      } catch (err) {
        console.error("Failed to persist session status:", err);
      }
    }
    if (onSessionClosed) {
      try {
        onSessionClosed(status);
      } catch (err) {
        console.error("onSessionClosed callback failed:", err);
      }
    }
  }

  useEffect(() => {
    onAssistantTurnFinalRef.current = onAssistantTurnFinal;
  }, [onAssistantTurnFinal]);

  useEffect(() => {
    onUserTranscriptFinalRef.current = onUserTranscriptFinal;
  }, [onUserTranscriptFinal]);

  useEffect(() => {
    onUserUtteranceStartedRef.current = onUserUtteranceStarted;
  }, [onUserUtteranceStarted]);

  useEffect(() => {
    onUserUtteranceFinishedRef.current = onUserUtteranceFinished;
  }, [onUserUtteranceFinished]);

  const scopeCatalog = useMemo(() => {
    const merged = new Map<string, Set<string>>();
    DEFAULT_SCOPE_RULES.forEach((scope) => {
      const keywords = new Set<string>(
        (scope.keywords || []).map((kw) => kw.toLowerCase())
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

  useEffect(() => {
    mutedRef.current = muted;
    const current = activeAssistantSourcesRef.current;
    for (const { gain } of current) {
      try {
        gain.gain.value = muted ? 0 : 1;
      } catch {
        // ignore
      }
    }
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
    if (scopesLoadedRef.current) return;
    scopesLoadedRef.current = true;
    async function loadScopes() {
      try {
        const apiScopes = await listScopes();
        setScopes(
          apiScopes.map((scope) => ({
            name: scope.name,
            keywords: scope.keywords || [],
          }))
        );
      } catch (err) {
        console.warn("Failed to load scopes:", err);
      }
    }
    void loadScopes();
  }, [listScopes]);

  useEffect(() => {
    // Reset flags on mount so subsequent remounts can reconnect correctly.
    didUnmountRef.current = false;
    closingForIdleRef.current = false;
    sessionClosedNotifiedRef.current = false;

    return () => {
      didUnmountRef.current = true;
      pendingConnectionRef.current = null;
      connectingRef.current = false;
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      if (introPromptTimeoutRef.current) {
        clearTimeout(introPromptTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Evita cerrar un socket en estado CONNECTING para no disparar
        // errores "closed before the connection was established".
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.close();
          } catch {
            // ignore
          }
        }
        wsRef.current = null;
      }
    };
  }, []);

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

  function scheduleIdleClose() {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    if (inCallRef.current) return;
    idleTimeoutRef.current = setTimeout(() => {
      if (inCallRef.current) return;
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        closingForIdleRef.current = true;
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        return;
      }
      // Without open socket: mark the session as expired anyway.
      void persistSessionStatus("expired");
    }, IDLE_TIMEOUT_MS);
  }

  function touchActivity() {
    lastActivityRef.current =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    scheduleIdleClose();
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

    const audioContext = audioContextRef.current;
    if (audioContext) {
      for (const entry of activeAssistantSourcesRef.current) {
        try {
          entry.source.stop();
        } catch {
          // ignore
        }
      }
    }
    activeAssistantSourcesRef.current = [];
    audioPlaybackTimeRef.current = null;

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

  async function transcribeUserUtterance(
    pcm16: Int16Array,
    messageId?: string,
    options?: { duringAssistant?: boolean }
  ) {
    try {
      touchActivity();
      if (!inCallRef.current) return;
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 =
        typeof btoa === "function" ? btoa(binary) : "";
      if (!base64) return;

      const transcript = await transcribe(base64);
      if (!transcript || !inCallRef.current) {
        return;
      }

      const lower = transcript.toLowerCase();
      const compact = lower.replace(/[^a-záéíóúüñ]/g, "");
      const isFillerUtterance =
        compact.length > 0 &&
        compact.length <= 6 &&
        !transcript.includes(" ") &&
        /^[mheauáéíóúsh]+$/.test(compact);
      if (isFillerUtterance) {
        // Treat very short, vowel/consonant-only utterances like
        // "mmm", "eh", "shh" as non-intentional noise. Remove any
        // breathing dot placeholder and reset utterance tracking so
        // nothing is rendered in the chat.
        if (messageId) {
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== messageId)
          );
        }
        userUtteranceActiveRef.current = false;
        userUtteranceChunksRef.current = [];
        userUtteranceLastVoiceMsRef.current = null;
        userUtteranceFirstVoiceMsRef.current = null;
        currentUserUtteranceIdRef.current = null;
        return;
      }

      const duringAssistant = Boolean(options?.duringAssistant);

      // For text/voice-hybrid mode (USE_VOICE_TRANSCRIBE=true), use
      // the intent classifier to decide whether this utterance should
      // become a real user turn or be ignored as noise.
      const isShortSingleWord =
        !transcript.includes(" ") && transcript.length <= 12;
      if (USE_VOICE_TRANSCRIBE && (duringAssistant || isShortSingleWord)) {
        try {
          const decisionRaw = await classifyIntent(transcript);
          if (decisionRaw) {
            const decision = decisionRaw.toUpperCase();

            if (decision === "IGNORE") {
              // Drop this utterance entirely from the chat UI
              // (remove placeholder if present) and do not
              // change scope or send to the assistant. Also
              // reset utterance tracking so any breathing dot
              // associated with this segment disappears.
              if (messageId) {
                setMessages((prev) =>
                  prev.filter((msg) => msg.id !== messageId)
                );
              }
              userUtteranceActiveRef.current = false;
              userUtteranceChunksRef.current = [];
              userUtteranceLastVoiceMsRef.current = null;
              userUtteranceFirstVoiceMsRef.current = null;
              currentUserUtteranceIdRef.current = null;

              // If this was noise while the assistant was speaking,
              // we just ignore it. If the assistant was silent, we
              // also drop it instead of showing a spurious bubble.
              return;
            }

            // USER_TURN: if the assistant is currently speaking,
            // interrupt the ongoing response so the next audio/text
            // belongs to this new turn. If the assistant is silent,
            // we simply treat this as a normal user turn.
            if (decision === "USER_TURN" && duringAssistant && assistantTalkingRef.current) {
              interruptAssistant();
              dropAssistantResponsesRef.current = false;
              dropAssistantAudioRef.current = false;
            }
          }
        } catch (err) {
          console.error(
            "Voice intent classification failed (falling back to USER_TURN):",
            err
          );
          // Fall through as USER_TURN.
        }
      }

      // At this point we have accepted this utterance as a real user
      // turn (not filler, not IGNORE). Ensure the next assistant
      // response is allowed to render in text/audio, even if a
      // previous turn was interrupted.
      dropAssistantResponsesRef.current = false;
      dropAssistantAudioRef.current = false;

      const nowTs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      lastUserTurnAtRef.current = nowTs;

      const nextScope = await autoDetectScope(transcript);

      // Always render the user's transcription as a bubble
      // (marked with meta "voice") so it is visible in the chat,
      // regardless of USE_VOICE_TRANSCRIBE.
      if (messageId) {
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i -= 1) {
            if (updated[i].id === messageId) {
              updated[i] = { ...updated[i], text: transcript, meta: "voice" };
              return updated;
            }
          }
          return [
            ...updated,
            {
              id: crypto.randomUUID(),
              from: "user",
              text: transcript,
              meta: "voice",
            },
          ];
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), from: "user", text: transcript, meta: "voice" },
        ]);
      }
      touchActivity();

      if (onUserTranscriptFinalRef.current) {
        await onUserTranscriptFinalRef.current(transcript);
      }
      if (onUserUtteranceFinishedRef.current) {
        onUserUtteranceFinishedRef.current();
      }
      if (nextScope && nextScope !== currentScope) {
        setCurrentScope(nextScope);
      }
    } catch (err) {
      console.error("Failed to transcribe user utterance:", err);
      if (onUserUtteranceFinishedRef.current) {
        onUserUtteranceFinishedRef.current();
      }
    }
  }

  function ensureAudioContext() {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const ctx = new AudioContextCtor({ sampleRate: 24000 }) as AudioContext;
    audioContextRef.current = ctx;
    return ctx;
  }

  async function startAudioStreaming() {
    if (typeof window === "undefined") return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (micStreamRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 24000,
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true,
      } as MediaTrackConstraints,
    });
    micStreamRef.current = stream;

    const audioContext = ensureAudioContext();
    if (!audioContext) {
      console.warn("AudioContext not available, cannot start streaming.");
      return;
    }

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (
        !inCallRef.current ||
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);
      let sumSquares = 0;
      for (let i = 0; i < input.length; i += 1) {
        let sample = input[i];
        sumSquares += sample * sample;
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        view.setInt16(
          i * 2,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
      }

      const rms =
        input.length > 0 ? Math.sqrt(sumSquares / input.length) : 0;

      const nowMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();

      // If the mic is muted, do not stream audio to the Realtime API
      // and do not treat user speech as barge-in. Just reset the
      // utterance buffers and exit early.
      if (micMutedRef.current) {
        userUtteranceActiveRef.current = false;
        userUtteranceChunksRef.current = [];
        userUtteranceLastVoiceMsRef.current = null;
        return;
      }

      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = typeof btoa === "function" ? btoa(binary) : "";

      if (base64) {
        try {
          if (!hasSentAudioRef.current) {
            hasSentAudioRef.current = true;
            wsRef.current.send(
              JSON.stringify({
                type: "client.audio.start",
              })
            );
          }
          wsRef.current.send(
            JSON.stringify({
              type: "client.audio.chunk",
              audio: base64,
            })
          );
        } catch (err) {
          console.error("Error sending audio chunk:", err);
        }
      }

      // Update a simple noise floor estimate when we are not
      // currently tracking an utterance, so we can make the
      // detector more conservative in noisy environments.
      if (!userUtteranceActiveRef.current) {
        const alpha = 0.05;
        const prev = noiseFloorRef.current || 0;
        const next = alpha * rms + (1 - alpha) * prev;
        noiseFloorRef.current = next;
      }

      const minFloor = VAD_VOICE_THRESHOLD / 2;
      const floor = Math.max(noiseFloorRef.current, minFloor);
      const dynamicThreshold = Math.max(
        VAD_VOICE_THRESHOLD,
        floor * VAD_NOISE_FACTOR
      );

      if (rms > dynamicThreshold) {
        // Start or continue tracking a potential utterance.
        if (!userUtteranceActiveRef.current) {
          userUtteranceActiveRef.current = true;
          userUtteranceChunksRef.current = [new Int16Array(buffer)];
          userUtteranceFirstVoiceMsRef.current = nowMs;
        } else {
          userUtteranceChunksRef.current.push(new Int16Array(buffer));
        }
        userUtteranceLastVoiceMsRef.current = nowMs;

        // Fast barge-in: if the assistant is currently speaking and
        // we detect a coherent block of user voice (both in time and
        // sample count), cancel the ongoing response immediately so
        // the next assistant turn belongs to this new utterance.
        if (
          assistantTalkingRef.current &&
          userUtteranceFirstVoiceMsRef.current !== null
        ) {
          const elapsedMs = nowMs - userUtteranceFirstVoiceMsRef.current;
          const totalSamples = userUtteranceChunksRef.current.reduce(
            (sum, c) => sum + c.length,
            0
          );
          const minBargeInSamples = USE_VOICE_TRANSCRIBE
            ? MIN_UTTERANCE_SAMPLES * 2
            : MIN_UTTERANCE_SAMPLES;
          if (
            elapsedMs >= BARGE_IN_MIN_MS &&
            totalSamples >= minBargeInSamples
          ) {
            interruptAssistant();
          }
        }

        // Only create the "…" placeholder once we have accumulated
        // enough audio to be considered a real utterance. This avoids
        // showing the breathing dot on very short spikes of noise,
        // such as right after starting the call.
        if (!currentUserUtteranceIdRef.current) {
          const totalSamples = userUtteranceChunksRef.current.reduce(
            (sum, c) => sum + c.length,
            0
          );
          if (totalSamples >= MIN_UTTERANCE_SAMPLES) {
            const id = crypto.randomUUID();
            currentUserUtteranceIdRef.current = id;
            // Ensure there is at most one breathing dot at a time.
            setMessages((prev) => {
              const withoutDots = prev.filter(
                (msg) => !(msg.from === "user" && msg.text === "…")
              );
              return [
                ...withoutDots,
                { id, from: "user", text: "…" },
              ];
            });
            if (onUserUtteranceStartedRef.current) {
              onUserUtteranceStartedRef.current();
            }
          }
        }
      } else if (
        userUtteranceActiveRef.current &&
        userUtteranceLastVoiceMsRef.current !== null &&
        nowMs - userUtteranceLastVoiceMsRef.current > VAD_SILENCE_MS
      ) {
        const chunks = userUtteranceChunksRef.current;
        userUtteranceActiveRef.current = false;
        userUtteranceChunksRef.current = [];
        userUtteranceLastVoiceMsRef.current = null;
        userUtteranceFirstVoiceMsRef.current = null;

        if (chunks.length > 0) {
          const totalSamples = chunks.reduce(
            (sum, c) => sum + c.length,
            0
          );
          const messageId = currentUserUtteranceIdRef.current;
          currentUserUtteranceIdRef.current = null;

          // If the utterance is too short (likely background noise),
          // drop the placeholder and skip transcription.
          if (totalSamples < MIN_UTTERANCE_SAMPLES) {
            if (messageId) {
              setMessages((prev) =>
                prev.filter((msg) => msg.id !== messageId)
              );
            }
            if (onUserUtteranceFinishedRef.current) {
              onUserUtteranceFinishedRef.current();
            }
            return;
          }

          const merged = new Int16Array(totalSamples);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const duringAssistant = assistantTalkingRef.current;
          void transcribeUserUtterance(merged, messageId || undefined, {
            duringAssistant,
          });
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioSourceNodeRef.current = source;
    audioProcessorRef.current = processor;
  }

  function stopAudioStreaming() {
    try {
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN &&
        hasSentAudioRef.current
      ) {
        wsRef.current.send(
          JSON.stringify({
            type: "client.audio.stop",
          })
        );
      }
    } catch (err) {
      console.error("Failed to send audio stop event:", err);
    }
    audioOutputActiveRef.current = false;

    if (audioProcessorRef.current) {
      try {
        audioProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      audioProcessorRef.current.onaudioprocess = null;
      audioProcessorRef.current = null;
    }

    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      audioSourceNodeRef.current = null;
    }

    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }

    hasSentAudioRef.current = false;
    userUtteranceActiveRef.current = false;
    userUtteranceChunksRef.current = [];
    userUtteranceLastVoiceMsRef.current = null;
  }

  function handleIncomingAudioChunk(arrayBuffer: ArrayBuffer) {
    if (typeof window === "undefined") return;
    if (!inCallRef.current) return;
    if (dropAssistantAudioRef.current) return;

    const audioContext = ensureAudioContext();
    if (!audioContext) return;

    // Mark assistant as speaking as soon as we receive audio
    // so the VAD path can treat new user speech as barge-in.
    if (!assistantTalkingRef.current) {
      assistantTalkingRef.current = true;
      setAssistantTalking(true);
    }

    const int16 = new Int16Array(arrayBuffer);
    if (!int16.length) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i += 1) {
      float32[i] = int16[i] / 0x8000;
    }

    const originalSampleRate = 24000;
    const buffer = audioContext.createBuffer(1, float32.length, originalSampleRate);
    buffer.copyToChannel(float32, 0);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = ASSISTANT_PLAYBACK_RATE;
    const gainNode = audioContext.createGain();
    gainNode.gain.value = mutedRef.current ? 0 : 1;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;
    if (
      audioPlaybackTimeRef.current === null ||
      audioPlaybackTimeRef.current < now
    ) {
      audioPlaybackTimeRef.current = now;
    }
    const startTime = audioPlaybackTimeRef.current;
    const chunkDuration = buffer.duration / ASSISTANT_PLAYBACK_RATE;
    audioPlaybackTimeRef.current += chunkDuration;

    source.start(startTime);

    activeAssistantSourcesRef.current.push({ source, gain: gainNode });

    source.onended = () => {
      activeAssistantSourcesRef.current =
        activeAssistantSourcesRef.current.filter((entry) => entry.source !== source);

      const ctx = audioContextRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      if (
        audioPlaybackTimeRef.current === null ||
        now >= audioPlaybackTimeRef.current - 0.05
      ) {
        setAssistantTalking(false);
        assistantTalkingRef.current = false;
      }
    };

    setLoading(false);
  }

  const scheduleReconnect = () => {
    if (didUnmountRef.current || reconnectTimeoutRef.current) return;
    if (!autoConnect && !inCallRef.current) return;
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      void connect();
    }, 1500);
  };

  function connect(): Promise<boolean> | void {
    if (didUnmountRef.current) return;
    if (!sessionId) {
      console.warn(
        "[useRealtimeSession] connect() called without sessionId; aborting WebSocket open"
      );
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (pendingConnectionRef.current) {
      return pendingConnectionRef.current;
    }
    if (connectingRef.current) return;

    // No connect if there is no real sessionId
    if (!sessionId) {
      return;
    }

    connectingRef.current = true;
    const urlWithSession =
      sessionId && wsUrl
        ? `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(
            sessionId
          )}`
        : wsUrl;
    const ws = new WebSocket(urlWithSession);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const connectionPromise = new Promise<boolean>((resolve) => {
      ws.onopen = () => {
        if (didUnmountRef.current) {
          resolve(false);
          return;
        }
        connectingRef.current = false;
        pendingConnectionRef.current = null;
        setWsConnected(true);
        pushSystem("Realtime WebSocket connected", "link");
        touchActivity();
        try {
          ws.send(
            JSON.stringify({
              type: "client.stats.request",
            })
          );
        } catch {
          // ignore stats request failures
        }
        resolve(true);
      };

      ws.onclose = () => {
        const unmounted = didUnmountRef.current;

        connectingRef.current = false;
        pendingConnectionRef.current = null;
        setWsConnected(false);

        if (closingForIdleRef.current) {
          closingForIdleRef.current = false;

          // Only show the idle timeout message if we are still mounted
          if (!unmounted) {
            pushSystem("Realtime WebSocket closed due to inactivity", "warning");
          }

          // Always persist the state, even if unmounted
          void persistSessionStatus("expired");
        } else {
          if (!unmounted) {
            pushSystem("Realtime WebSocket disconnected", "warning");
            setCallStatus("idle");
            scheduleReconnect();
          }

          // Always persist the state, even if unmounted
          void persistSessionStatus("closed");
        }

        resolve(false);
      };

      ws.onerror = (err) => {
        if (didUnmountRef.current) {
          resolve(false);
          return;
        }
        connectingRef.current = false;
        pendingConnectionRef.current = null;
        const message =
          err instanceof ErrorEvent
            ? err.message
            : typeof err === "object" && err && "message" in err
            ? (err as any).message
            : "";
        if (wsConnectedRef.current) {
          if (message) {
            console.error("WS error:", message);
            pushSystem(`WebSocket error: ${message}`, "error");
          } else {
            console.warn("WS error (no details)");
          }
        } else {
          console.warn("WS connection failed, will retry…", message || err);
        }
        try {
          ws.close();
        } catch {
          // ignore
        }
        resolve(false);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data !== "string") {
          try {
            const arrayBuffer =
              event.data instanceof ArrayBuffer
                ? event.data
                : await (event.data as Blob).arrayBuffer();
            handleIncomingAudioChunk(arrayBuffer);
          } catch (err) {
            console.error("Error handling incoming audio chunk:", err);
          }
          return;
        }

        try {
          const data = JSON.parse(event.data);
          const currentResponseId = currentResponseIdRef.current;
          const eventResponseId =
            data.response_id || data.response?.id || data.id;

          if (data.type === "ui.command") {
            handleUiCommand(String(data.command || ""), data.args);
            return;
          }

          if (data.type === "server.stats") {
            const count = Number(data.connections);
            setBridgeConnections(Number.isFinite(count) ? count : null);
            return;
          }

          if (data.type === "response.audio_transcript.delta") {
            audioOutputActiveRef.current = true;
            const delta: string = data.delta ?? "";
            if (
              !delta ||
              dropAssistantResponsesRef.current ||
              !currentResponseId ||
              (eventResponseId && eventResponseId !== currentResponseId)
            ) {
              return;
            }
            currentAssistantTextRef.current += delta;
          }

          if (data.type === "response.created") {
            const id = data.response?.id || data.id;
            if (id) {
              currentResponseIdRef.current = id;
            }
            if (!USE_VOICE_TRANSCRIBE) {
              dropAssistantResponsesRef.current = false;
              dropAssistantAudioRef.current = false;
            }
            currentAssistantTextRef.current = "";
            pendingAssistantTextRef.current = null;
            setLoading(false);
          }

          if (data.type === "response.audio.delta") {
            audioOutputActiveRef.current = true;
            setLoading(false);
          }

          if (data.type === "response.audio_transcript.done") {
            const finalText: string =
              (data.transcript as string) ??
              (data.text as string) ??
              currentAssistantTextRef.current;
            currentAssistantTextRef.current = "";
            if (
              !finalText ||
              dropAssistantResponsesRef.current ||
              !currentResponseId ||
              (eventResponseId && eventResponseId !== currentResponseId)
            ) {
              pendingAssistantTextRef.current = null;
              return;
            }
            pendingAssistantTextRef.current = finalText;
            flushPendingAssistantText(80);

            if (onAssistantTurnFinalRef.current) {
              try {
                onAssistantTurnFinalRef.current(finalText);
              } catch (err) {
                console.error(
                  "onAssistantTurnFinal callback threw an error:",
                  err
                );
              }
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
            audioOutputActiveRef.current = false;
          }

          if (data.type === "response.text.delta") {
            if (audioOutputActiveRef.current) {
              return;
            }
            const delta: string = data.delta ?? "";
            if (
              !delta ||
              dropAssistantResponsesRef.current ||
              !currentResponseId ||
              (eventResponseId && eventResponseId !== currentResponseId)
            ) {
              return;
            }
            currentAssistantTextRef.current += delta;
          }

          if (data.type === "response.text.done") {
            if (audioOutputActiveRef.current) {
              return;
            }
            const finalText: string =
              (data.text as string) ?? currentAssistantTextRef.current;
            currentAssistantTextRef.current = "";
            if (
              !finalText ||
              dropAssistantResponsesRef.current ||
              !currentResponseId ||
              (eventResponseId && eventResponseId !== currentResponseId)
            ) {
              pendingAssistantTextRef.current = null;
              return;
            }
            pendingAssistantTextRef.current = finalText;
            flushPendingAssistantText(80);

            if (onAssistantTurnFinalRef.current) {
              try {
                onAssistantTurnFinalRef.current(finalText);
              } catch (err) {
                console.error(
                  "onAssistantTurnFinal callback threw an error:",
                  err
                );
              }
            }
          }

          if (
            data.type === "error" ||
            data.type === "response.error" ||
            data.error
          ) {
            const errorCode = data?.error?.code || data?.code;
            const hasDetails = data?.error || data?.message;

            if (!hasDetails && !errorCode) {
              console.warn(
                "Realtime error event without details (ignored):",
                data
              );
              return;
            }
            if (errorCode === "input_audio_buffer_commit_empty") {
              console.warn("Ignoring benign realtime audio error:", data);
              return;
            }
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
            if (data.status === "started") {
              playCue("tool");
            }
            pushSystem(`Tool invoked: ${details}`, "tool");
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
          setLoading(false);
        }
      };
    });

    pendingConnectionRef.current = connectionPromise;
    return connectionPromise;
  }

  useEffect(() => {
    if (!autoConnect) return;
    if (!sessionId) return;

    const current = wsRef.current;

    // If there is already an open WS but with a different sessionId, close it to force a new one.
    if (
      current &&
      current.readyState === WebSocket.OPEN &&
      lastSessionIdRef.current &&
      lastSessionIdRef.current !== sessionId
    ) {
      try {
        current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    // If there is no WS or it is closed, connect with the current sessionId.
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      lastSessionIdRef.current = sessionId;
      void connect();
    }

    return () => {
      reconnectTimeoutRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, sessionId, wsUrl]);

  async function ensureConnected(): Promise<boolean> {
    if (!sessionId) {
      console.warn(
        "[useRealtimeSession] ensureConnected() called without sessionId; aborting WebSocket open"
      );
      return false;
    }
    const maybePromise = connect();
    if (maybePromise instanceof Promise) {
      try {
        await maybePromise;
      } catch {
        return false;
      }
    }
    return wsRef.current?.readyState === WebSocket.OPEN;
  }

  async function detectScopeViaVectors(text: string) {
    const scope = await detectScope(text);
    return scope;
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

  async function sendUserMessage(
    text: string,
    options?: {
      silent?: boolean;
      conversationId?: string | null;
      assistantId?: string | null;
    }
  ) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    touchActivity();

    const ready = await ensureConnected();
    if (!ready || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      pushSystem("No se pudo conectar con el servidor de voz", "warning");
      return;
    }
    touchActivity();

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
      scopeForMessage = await autoDetectScope(trimmed);
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
    } = {
      type: "user_message",
      text: trimmed,
      scope: scopeForMessage,
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
    if (callStatus === "calling" || callStatus === "in_call") return;

    void (async () => {
      touchActivity();
      const ready = await ensureConnected();
      if (!ready || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        pushSystem("No se pudo conectar con el servidor de voz", "warning");
        return;
      }
      touchActivity();

      dropAssistantResponsesRef.current = false;
      dropAssistantAudioRef.current = false;
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
    })();
  }

  function endCall() {
    inCallRef.current = false;
    setInCall(false);
    setCallStatus("idle");
    setMuted(false);
    setMicMuted(false);
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
    pendingAssistantTextRef.current = null;
    currentAssistantTextRef.current = "";
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

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioPlaybackTimeRef.current = null;
    if (introPromptTimeoutRef.current) {
      clearTimeout(introPromptTimeoutRef.current);
      introPromptTimeoutRef.current = null;
    }
    void persistSessionStatus("closed");
  }

  function toggleSpeaker() {
    setMuted((prev) => !prev);
  }

  function toggleMic() {
    setMicMuted((prev) => {
      const next = !prev;
      micMutedRef.current = next;
      return next;
    });
  }

  const sessionActive = callStatus !== "idle";
  const canStartCall = !sessionActive;
  const sendDisabled = input.trim()
    ? false
    : callStatus === "calling";
  const isRecording = inCall && !micMuted;

  function connectNow() {
    closingForIdleRef.current = false;
    return ensureConnected();
  }

  // If autoConnect is disabled, try to open the WS as soon as the user starts typing,
  // so that sending text does not fail due to lack of connection.
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
        setMuted(true);
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
        setMuted(false);
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
    bridgeConnections,

    // setters / handlers
    setInput,
    setMessages,
    startCall,
    endCall,
    toggleSpeaker,
    toggleMic,
    handleSubmit,
    sendUserMessage,
    connectNow,
  };
}
