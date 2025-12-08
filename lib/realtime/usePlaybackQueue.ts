import { useCallback, useRef, useState } from "react";

type PlaybackOptions = {
  playbackRate: number;
  onStartTalking?: () => void;
  onStopTalking?: () => void;
  initialMuted?: boolean;
};

export function usePlaybackQueue(options: PlaybackOptions) {
  const { playbackRate, onStartTalking, onStopTalking, initialMuted = false } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackTimeRef = useRef<number | null>(null);
  const activeAssistantSourcesRef = useRef<
    { source: AudioBufferSourceNode; gain: GainNode }[]
  >([]);
  const [muted, setMuted] = useState(initialMuted);

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

  const handleIncomingAudioChunk = useCallback(
    (arrayBuffer: ArrayBuffer, dropAudio: boolean) => {
      if (dropAudio) return;

      const audioContext = ensureAudioContext();
      if (!audioContext) return;

      onStartTalking?.();

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
      source.playbackRate.value = playbackRate;
      const gainNode = audioContext.createGain();
      gainNode.gain.value = muted ? 0 : 1;
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
      const chunkDuration = buffer.duration / playbackRate;
      audioPlaybackTimeRef.current += chunkDuration;

      source.start(startTime);

      activeAssistantSourcesRef.current.push({ source, gain: gainNode });

      source.onended = () => {
        activeAssistantSourcesRef.current =
          activeAssistantSourcesRef.current.filter((entry) => entry.source !== source);

        const ctx = audioContextRef.current;
        if (!ctx) return;
        const nowTime = ctx.currentTime;
        if (
          audioPlaybackTimeRef.current === null ||
          nowTime >= audioPlaybackTimeRef.current - 0.05
        ) {
          onStopTalking?.();
        }
      };
    },
    [ensureAudioContext, muted, onStartTalking, onStopTalking, playbackRate]
  );

  const interruptAssistantAudio = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx) {
      activeAssistantSourcesRef.current.forEach(({ source }) => {
        try {
          source.stop();
        } catch {
          // ignore
        }
      });
      activeAssistantSourcesRef.current = [];
      audioPlaybackTimeRef.current = null;
    }
    onStopTalking?.();
  }, [onStopTalking]);

  const updateMuted = useCallback((nextMuted: boolean) => {
    setMuted(nextMuted);
    const current = activeAssistantSourcesRef.current;
    for (const { gain } of current) {
      try {
        gain.gain.value = nextMuted ? 0 : 1;
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    muted,
    setMuted: updateMuted,
    handleIncomingAudioChunk,
    interruptAssistantAudio,
    ensureAudioContext,
  };
}
