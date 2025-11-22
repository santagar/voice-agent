import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TRANSCRIPTION_MODEL =
  process.env.TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json();

    if (!audio || typeof audio !== "string") {
      return NextResponse.json(
        { error: "Body must include base64-encoded 'audio'." },
        { status: 400 }
      );
    }

    const pcmBuffer = Buffer.from(audio, "base64");
    if (!pcmBuffer.length) {
      return NextResponse.json(
        { error: "Audio payload is empty." },
        { status: 400 }
      );
    }

    // Wrap raw PCM16 (mono, 24 kHz) into a minimal WAV container
    // so the transcription endpoint can parse it reliably.
    const wavBuffer = encodePcm16ToWav(pcmBuffer, 24000, 1);
    const wavBytes = new Uint8Array(wavBuffer);
    const file = new File([wavBytes], "audio.wav", { type: "audio/wav" });

    const transcription = await client.audio.transcriptions.create({
      model: TRANSCRIPTION_MODEL,
      file,
      // language: "es", // uncomment if you want to force Spanish
    });

    return NextResponse.json({ text: transcription.text ?? "" });
  } catch (err: any) {
    console.error(
      "Error in /api/transcribe:",
      err?.response?.data || err?.message || err
    );
    return NextResponse.json(
      { error: "Error transcribing audio" },
      { status: 500 }
    );
  }
}

function encodePcm16ToWav(
  pcm: Buffer,
  sampleRate: number,
  numChannels: number
): Buffer {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  let offset = 0;
  buffer.write("RIFF", offset); // ChunkID
  offset += 4;
  buffer.writeUInt32LE(totalSize - 8, offset); // ChunkSize
  offset += 4;
  buffer.write("WAVE", offset); // Format
  offset += 4;

  // fmt subchunk
  buffer.write("fmt ", offset); // Subchunk1ID
  offset += 4;
  buffer.writeUInt32LE(16, offset); // Subchunk1Size (PCM)
  offset += 4;
  buffer.writeUInt16LE(1, offset); // AudioFormat (PCM)
  offset += 2;
  buffer.writeUInt16LE(numChannels, offset); // NumChannels
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); // SampleRate
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset); // ByteRate
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); // BlockAlign
  offset += 2;
  buffer.writeUInt16LE(bytesPerSample * 8, offset); // BitsPerSample
  offset += 2;

  // data subchunk
  buffer.write("data", offset); // Subchunk2ID
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset); // Subchunk2Size
  offset += 4;

  pcm.copy(buffer, offset);
  return buffer;
}
