import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const INTENT_MODEL = process.env.INTENT_MODEL || "gpt-4o-mini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Body must include 'text' as a non-empty string." },
        { status: 400 }
      );
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return NextResponse.json({ decision: "IGNORE" });
    }

    const system = [
      "You are a tiny intent classifier for a voice assistant.",
      "Your job is to decide if a short piece of transcribed audio",
      "represents a meaningful attempt by the user to talk to the assistant",
      "while the assistant is speaking, or if it should be ignored.",
      "",
      "Rules:",
      "- Respond with exactly one token: USER_TURN or IGNORE.",
      "- USER_TURN: the user is clearly trying to ask something,",
      "  give an instruction, or otherwise interact with the assistant.",
      "- IGNORE: background noise, keyboard, music, breathing,",
      "  filler like 'mmm', 'eh', 'ah', partial non-words, etc.",
      "- Do not explain, do not add punctuation, ONLY the label.",
    ].join("\n");

    // Use a lightweight chat completion for classification rather than
    // the Responses API to keep the shape simple and robust.
    const completion = await client.chat.completions.create({
      model: INTENT_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Text from microphone: """${trimmed}"""\n\nRespond with USER_TURN or IGNORE.`,
        },
      ],
      max_tokens: 4,
      temperature: 0,
    });

    const choice = completion.choices[0]?.message?.content ?? "";
    let decision = String(choice || "").trim().toUpperCase();

    if (decision !== "USER_TURN" && decision !== "IGNORE") {
      decision = "USER_TURN";
    }

    return NextResponse.json({ decision });
  } catch (err: any) {
    console.error(
      "Error in /api/voice-intent:",
      err?.response?.data || err?.message || err
    );
    // Fail-open: if classification fails, treat as USER_TURN so we do not
    // silently drop real user attempts to speak.
    return NextResponse.json({ decision: "USER_TURN" });
  }
}
