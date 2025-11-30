import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

type MessageMeta = {
  turnType?: string;
  scope?: string | null;
  inputMode?: string | null;
  outputMode?: string | null;
  bargeIn?: boolean;
  [key: string]: unknown;
};

function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  const maxLen = 60;
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen).trimEnd() + "…";
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const body = (await req.json().catch(() => null)) as
      | { from?: string; text?: string; meta?: MessageMeta | null }
      | null;

    if (!body || typeof body.text !== "string" || typeof body.from !== "string") {
      return NextResponse.json(
        { error: "Invalid message payload" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Compute the next sequence number within this conversation so
    // that messages can be replayed deterministically.
    const last = await prisma.message.findFirst({
      where: { conversationId: id },
      orderBy: { sequence: "desc" },
    });
    const nextSequence = (last?.sequence ?? 0) + 1;

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        from: body.from,
        text: body.text,
        sequence: nextSequence,
        meta: (body.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // Heuristic: if the conversation still has the default title,
    // upgrade it to a snippet of the first non-empty message text.
    if (conversation.title === "New chat" && body.text.trim()) {
      await prisma.conversation.update({
        where: { id },
        data: {
          title: deriveTitle(body.text),
        },
      });
    } else {
      // Always bump updatedAt via a no-op update to reflect activity.
      await prisma.conversation.update({
        where: { id },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      message: {
        id: message.id,
        from: message.from,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Failed to append message:", err);
    return NextResponse.json(
      { error: "Failed to append message" },
      { status: 500 }
    );
  }
}
