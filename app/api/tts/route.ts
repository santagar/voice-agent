import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing 'text' string in body" },
        { status: 400 }
      );
    }

    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice || "alloy", // you can switch voices: alloy, ash, ballad, echo, etc.
      input: text,
      // JS SDK defaults to MP3; uncomment to force a format:
      // format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Error in /api/tts:", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Error generating audio" }, { status: 500 });
  }
}
