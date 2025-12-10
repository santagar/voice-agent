import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionSchema } from "./schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { userId = null, assistantId, conversationId = null, channel = "web", assistantConfig = null } = parsed.data;

    // Reuse an active session for the same assistant + conversation + user if it exists.
    const existing = await prisma.session.findFirst({
      where: {
        assistantId,
        conversationId,
        userId,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({ session: existing });
    }

    // If a conversationId was provided but no longer exists (e.g., deleted),
    // avoid a foreign key violation by nullifying it.
    let safeConversationId: string | null = conversationId;
    if (conversationId) {
      const exists = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!exists) {
        safeConversationId = null;
      }
    }

    const session = await prisma.session.create({
      data: {
        userId,
        assistantId,
        conversationId: safeConversationId,
        channel,
        assistantConfig,
        status: "active",
      },
    });

    return NextResponse.json({ session });
  } catch (err) {
    console.error("Failed to create session:", err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
