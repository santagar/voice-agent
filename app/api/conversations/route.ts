import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lists conversations ordered by last activity, including a short preview
// of the most recent message. The client can later filter this by user
// or assistant if needed.
export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({
      conversations: conversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        mode: conv.mode,
        status: conv.status,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        lastMessagePreview: conv.messages[0]?.text ?? null,
        lastMessageAt: conv.messages[0]
          ? conv.messages[0].createdAt.toISOString()
          : null,
      })),
    });
  } catch (err: any) {
    console.error("Failed to list conversations:", err);
    return NextResponse.json(
      { error: "Failed to list conversations" },
      { status: 500 }
    );
  }
}

// Creates a new conversation for a given assistant/workspace (and optional user).
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      mode?: string;
      userId?: string | null;
      assistantId?: string;
      workspaceId?: string;
    };

    if (!body.assistantId || !body.workspaceId) {
      return NextResponse.json(
        { error: "assistantId and workspaceId are required" },
        { status: 400 }
      );
    }

    const rawTitle =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "New chat";

    const conversation = await prisma.conversation.create({
      data: {
        title: rawTitle,
        mode: typeof body.mode === "string" ? body.mode : "unknown",
        userId: typeof body.userId === "string" ? body.userId : null,
        assistantId: body.assistantId,
        workspaceId: body.workspaceId,
      },
    });

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        status: conversation.status,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Failed to create conversation:", err);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}

