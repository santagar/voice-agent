import { useEffect, useMemo, useRef, useState } from "react";

export type VoiceMessage = {
  id: string;
  from: "user" | "assistant" | "system";
  text: string;
  meta?: string;
};

export type CallStatus = "idle" | "calling" | "in_call";

export type ScopeDefinition = {
  name: string;
  keywords: string[];
};

type UseRealtimeVoiceSessionOptions = {
  startCallPrompt?: string;
  initialScope?: string;
  wsUrl?: string;
};

const ASSISTANT_PLAYBACK_RATE =
  Number(process.env.NEXT_PUBLIC_ASSISTANT_PLAYBACK_RATE ?? "1.05");
const VAD_VOICE_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_VAD_VOICE_THRESHOLD ?? "0.008"
);
const VAD_SILENCE_MS = Number(
  process.env.NEXT_PUBLIC_VAD_SILENCE_MS ?? "500"
);

// Minimum number of PCM16 samples required to treat a detected
// voice segment as a real utterance to transcribe. At 24kHz,
// 2400 samples ≈ 100ms of audio.
const MIN_UTTERANCE_SAMPLES = 2400;

const DEFAULT_SCOPE_RULES: ScopeDefinition[] = [];

export function useRealtimeVoiceSession(
  options: UseRealtimeVoiceSessionOptions = {}
) {
  const {
    startCallPrompt = "",
    initialScope = "support",
    wsUrl = "ws://localhost:4001",
  } = options;

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
  const [currentScope, setCurrentScope] = useState<string>(initialScope);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioPlaybackTimeRef = useRef<number | null>(null);
  const activeAssistantSourcesRef = useRef<
    { source: AudioBufferSourceNode; gain: GainNode }[]
  >([]);
  const userUtteranceChunksRef = useRef<Int16Array[]>([]);
  const userUtteranceActiveRef = useRef(false);
  const userUtteranceLastVoiceMsRef = useRef<number | null>(null);
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
  const assistantPlaceholderRef = useRef(false);
  const pendingAssistantTextRef = useRef<string | null>(null);
  const dropAssistantResponsesRef = useRef(false);
  const dropAssistantAudioRef = useRef(false);
  const introPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    messageId?: string
  ) {
    try {
      if (!inCallRef.current) return;
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 =
        typeof btoa === "function" ? btoa(binary) : "";
      if (!base64) return;

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });
      if (!res.ok) {
        console.warn("STT /api/transcribe error:", await res.text());
        return;
      }
      const data = (await res.json()) as { text?: string };
      const transcript = (data.text || "").trim();
      if (!transcript || !inCallRef.current) {
        return;
      }

      const nextScope = await autoDetectScope(transcript);
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
      if (nextScope && nextScope !== currentScope) {
        setCurrentScope(nextScope);
      }
    } catch (err) {
      console.error("Failed to transcribe user utterance:", err);
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
        typeof performance !== "undefined" && performance.now
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

      if (rms > VAD_VOICE_THRESHOLD) {
        if (assistantTalkingRef.current) {
          interruptAssistant();
        }

        // Start or continue tracking a potential utterance.
        if (!userUtteranceActiveRef.current) {
          userUtteranceActiveRef.current = true;
          userUtteranceChunksRef.current = [new Int16Array(buffer)];
        } else {
          userUtteranceChunksRef.current.push(new Int16Array(buffer));
        }
        userUtteranceLastVoiceMsRef.current = nowMs;

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
            setMessages((prev) => [
              ...prev,
              { id, from: "user", text: "…" },
            ]);
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
            return;
          }

          const merged = new Int16Array(totalSamples);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }

          void transcribeUserUtterance(merged, messageId || undefined);
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
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
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
          // ignore
        }
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

          if (data.type === "response.text.delta") {
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

          if (data.type === "response.audio_transcript.delta") {
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
            dropAssistantResponsesRef.current = false;
            dropAssistantAudioRef.current = false;
            currentAssistantTextRef.current = "";
            pendingAssistantTextRef.current = null;
            setLoading(false);
          }

          if (data.type === "response.audio.delta") {
            setLoading(false);
          }

          if (data.type === "response.text.done") {
            const finalText = currentAssistantTextRef.current;
            currentAssistantTextRef.current = "";
            if (
              !finalText ||
              dropAssistantResponsesRef.current ||
              !currentResponseId ||
              (eventResponseId && eventResponseId !== currentResponseId)
            ) {
              pendingAssistantTextRef.current = null;
              setLoading(false);
              return;
            }
            pendingAssistantTextRef.current = finalText;
            flushPendingAssistantText(80);
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
            const errorCode = data?.error?.code || data?.code;
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
            pushSystem(`Tool invoked: ${details}`, "tool");
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
          setLoading(false);
        }
      };
    };

    connect();
  }, [wsUrl]);

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
    options?: { silent?: boolean }
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
      const AudioContextCtor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
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

  function startCall() {
    if (!wsConnected) {
      alert("Realtime server not connected");
      return;
    }

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
      if (startCallPrompt) {
        void sendUserMessage(startCallPrompt, { silent: true });
      }
    }, 500);
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
  const canStartCall = wsConnected && !sessionActive;
  const sendDisabled = input.trim()
    ? !wsConnected
    : sessionActive
    ? false
    : !canStartCall;
  const isRecording = inCall && !micMuted;

  function handleUiCommand(command: string, args: any) {
    switch (command) {
      case "end_call":
        endCall();
        break;
      case "mute_speaker":
        // Force speaker muted, regardless of current state.
        setMuted(true);
        mutedRef.current = true;
        // Speaker mute is a local UI concern; do not
        // keep dropping assistant audio chunks after this.
        dropAssistantAudioRef.current = false;
        break;
      case "unmute_speaker":
        // Force speaker unmuted, regardless of current state.
        setMuted(false);
        mutedRef.current = false;
        // Ensure future assistant audio is accepted again.
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
