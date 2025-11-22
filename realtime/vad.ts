// realtime/vad.ts
// RNNoise-based VAD abstraction for PCM16 frames, using @jitsi/rnnoise-wasm.
//
// En este entorno del CLI no podemos instalar ni cargar realmente
// @jitsi/rnnoise-wasm, así que usamos un require dinámico y, si falla,
// devolvemos un VAD "passthrough" que deja pasar todo el audio.
//
// En tu máquina, con `npm install @jitsi/rnnoise-wasm`, el require se
// resolverá y podrás usar RNNoise real.

let RnnoiseCtor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@jitsi/rnnoise-wasm");
  RnnoiseCtor = (mod && (mod.Rnnoise || mod.default || mod)) || null;
} catch {
  RnnoiseCtor = null;
}

export type VadConfig = {
  // RNNoise is typically trained at 48 kHz. If your incoming audio
  // is at 24 kHz, you can either:
  //   - upsample, or
  //   - accept that the frame duration seen by RNNoise será distinta
  //     (pero seguirá sirviendo para distinguir voz/ruido).
  sampleRate: 16000 | 48000;
  frameMs: 10 | 20 | 30;
  speechThreshold?: number; // 0.0–1.0
};

export interface Vad {
  sampleRate: number;
  frameSize: number;
  isSpeech(framePcm16: Int16Array): boolean;
}

export async function createVad(config: VadConfig): Promise<Vad> {
  const sampleRate = config.sampleRate;
  const frameMs = config.frameMs;
  const frameSize = Math.round((sampleRate * frameMs) / 1000);
  // Be conservative by default: require high confidence that
  // a frame contains speech before forwarding audio upstream.
  const speechThreshold = config.speechThreshold ?? 0.8;

  // Si rnnoise-wasm no está disponible (por ejemplo, en este sandbox),
  // devolvemos un VAD que siempre marca voz para no romper el flujo.
  if (!RnnoiseCtor) {
    console.warn(
      "RNNoise module not available; input VAD will pass all audio through."
    );
    return {
      sampleRate,
      frameSize,
      isSpeech: () => true,
    };
  }

  // Ajusta esta parte según la API real de rnnoise-wasm que tengáis.
  const rn =
    typeof RnnoiseCtor.create === "function"
      ? await RnnoiseCtor.create()
      : new RnnoiseCtor();

  return {
    sampleRate,
    frameSize,
    isSpeech(framePcm16: Int16Array): boolean {
      if (framePcm16.length < frameSize) return false;

      // RNNoise suele esperar Float32 en [-1, 1].
      const floatFrame = new Float32Array(frameSize);
      const len = Math.min(framePcm16.length, frameSize);
      for (let i = 0; i < len; i += 1) {
        floatFrame[i] = framePcm16[i] / 32768;
      }

      // La API concreta puede variar; ajusta si la lib expone otro método.
      const prob: number = rn.processFrame(floatFrame);
      return prob >= speechThreshold;
    },
  };
}
