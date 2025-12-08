import { useCallback, useRef } from "react";

type UseAudioInOptions = {
  wsRef: React.MutableRefObject<WebSocket | null>;
  inCallRef: React.MutableRefObject<boolean>;
  micMutedRef: React.MutableRefObject<boolean>;
  assistantTalkingRef: React.MutableRefObject<boolean>;
  hasSentAudioRef: React.MutableRefObject<boolean>;
  dropAssistantResponsesRef: React.MutableRefObject<boolean>;
  dropAssistantAudioRef: React.MutableRefObject<boolean>;
  userUtteranceChunksRef: React.MutableRefObject<Int16Array[]>;
  userUtteranceActiveRef: React.MutableRefObject<boolean>;
  userUtteranceLastVoiceMsRef: React.MutableRefObject<number | null>;
  userUtteranceFirstVoiceMsRef: React.MutableRefObject<number | null>;
  currentUserUtteranceIdRef: React.MutableRefObject<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  minUtteranceSamples: number;
  vadVoiceThreshold: number;
  vadNoiseFactor: number;
  vadSilenceMs: number;
  bargeInMinMs: number;
  useVoiceTranscribe: boolean;
  onUtteranceComplete: (
    audio: Int16Array,
    messageId?: string,
    meta?: { duringAssistant?: boolean }
  ) => void | Promise<void>;
  onBargeIn?: () => void;
};

/**
 * Handles mic capture, streaming to the realtime bridge, VAD, and barge-in.
 * Delegates transcription/intent handling to the caller via onUtteranceComplete.
 */
export function useAudioIn({
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
  minUtteranceSamples,
  vadVoiceThreshold,
  vadNoiseFactor,
  vadSilenceMs,
  bargeInMinMs,
  useVoiceTranscribe,
  onUtteranceComplete,
  onBargeIn,
}: UseAudioInOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const noiseFloorRef = useRef(0);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const ctx = new AudioContextCtor({ sampleRate: 24000 }) as AudioContext;
    audioContextRef.current = ctx;
    return ctx;
  }, []);

  const resetUtteranceTracking = useCallback(() => {
    userUtteranceActiveRef.current = false;
    userUtteranceChunksRef.current = [];
    userUtteranceLastVoiceMsRef.current = null;
    userUtteranceFirstVoiceMsRef.current = null;
  }, [userUtteranceActiveRef, userUtteranceChunksRef, userUtteranceFirstVoiceMsRef, userUtteranceLastVoiceMsRef]);

  const stopAudioStreaming = useCallback(() => {
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
    } catch {
      // ignore
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
    resetUtteranceTracking();
  }, [hasSentAudioRef, resetUtteranceTracking, wsRef]);

  const startAudioStreaming = useCallback(async () => {
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
        resetUtteranceTracking();
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
      // currently tracking an utterance.
      if (!userUtteranceActiveRef.current) {
        const alpha = 0.05;
        const prev = noiseFloorRef.current || 0;
        const next = alpha * rms + (1 - alpha) * prev;
        noiseFloorRef.current = next;
      }

      const minFloor = vadVoiceThreshold / 2;
      const floor = Math.max(noiseFloorRef.current, minFloor);
      const dynamicThreshold = Math.max(vadVoiceThreshold, floor * vadNoiseFactor);

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

        // Fast barge-in.
        if (
          assistantTalkingRef.current &&
          userUtteranceFirstVoiceMsRef.current !== null
        ) {
          const elapsedMs = nowMs - userUtteranceFirstVoiceMsRef.current;
          const totalSamples = userUtteranceChunksRef.current.reduce(
            (sum, c) => sum + c.length,
            0
          );
          const minBargeInSamples = useVoiceTranscribe
            ? minUtteranceSamples * 2
            : minUtteranceSamples;
          if (
            elapsedMs >= bargeInMinMs &&
            totalSamples >= minBargeInSamples
          ) {
            onBargeIn?.();
          }
        }

        // Only create the "…" placeholder once we have accumulated
        // enough audio to be considered a real utterance.
        if (!currentUserUtteranceIdRef.current) {
          const totalSamples = userUtteranceChunksRef.current.reduce(
            (sum, c) => sum + c.length,
            0
          );
          if (totalSamples >= minUtteranceSamples) {
            const id = crypto.randomUUID();
            currentUserUtteranceIdRef.current = id;
            setMessages((prev) => {
              const withoutDots = prev.filter(
                (msg) => !(msg.from === "user" && msg.text === "…")
              );
              return [
                ...withoutDots,
                { id, from: "user", text: "…" },
              ];
            });
          }
        }
      } else if (
        userUtteranceActiveRef.current &&
        userUtteranceLastVoiceMsRef.current !== null &&
        nowMs - userUtteranceLastVoiceMsRef.current > vadSilenceMs
      ) {
        const chunks = userUtteranceChunksRef.current;
        resetUtteranceTracking();

        if (chunks.length > 0) {
          const totalSamples = chunks.reduce(
            (sum, c) => sum + c.length,
            0
          );
          const messageId = currentUserUtteranceIdRef.current;
          currentUserUtteranceIdRef.current = null;

          // If the utterance is too short (likely background noise),
          // drop the placeholder and skip transcription.
          if (totalSamples < minUtteranceSamples) {
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
          const duringAssistant = assistantTalkingRef.current;
          void onUtteranceComplete(merged, messageId || undefined, {
            duringAssistant,
          });
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioSourceNodeRef.current = source;
    audioProcessorRef.current = processor;
  }, [
    assistantTalkingRef,
    bargeInMinMs,
    currentUserUtteranceIdRef,
    ensureAudioContext,
    hasSentAudioRef,
    inCallRef,
    micMutedRef,
    minUtteranceSamples,
    onBargeIn,
    onUtteranceComplete,
    resetUtteranceTracking,
    setMessages,
    userUtteranceActiveRef,
    userUtteranceChunksRef,
    userUtteranceFirstVoiceMsRef,
    userUtteranceLastVoiceMsRef,
    vadNoiseFactor,
    vadSilenceMs,
    vadVoiceThreshold,
    wsRef,
    useVoiceTranscribe,
  ]);

  return {
    startAudioStreaming,
    stopAudioStreaming,
    ensureAudioContext,
    resetUtteranceTracking,
  };
}
