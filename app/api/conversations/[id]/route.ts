import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// Fetches a single conversation and its messages so the chat
// client can hydrate historical context when opening /c/[id].
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        status: conversation.status,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
      messages: conversation.messages.map((m) => ({
        id: m.id,
        from: m.from,
        text: m.text,
        sequence: m.sequence,
        createdAt: m.createdAt.toISOString(),
        toolCallId: m.toolCallId,
      })),
    });
  } catch (err: any) {
    console.error("Failed to load conversation by id:", err);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}

// Lightweight update endpoint used for actions like "archive".
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      title?: string;
    };

    if (body.action === "archive") {
      const conversation = await prisma.conversation.update({
        where: { id },
        data: { status: "archived" },
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
    }

    if (body.action === "rename") {
      const rawTitle =
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : null;
      if (!rawTitle) {
        return NextResponse.json(
          { error: "A non-empty title is required to rename a conversation" },
          { status: 400 }
        );
      }

      const conversation = await prisma.conversation.update({
        where: { id },
        data: { title: rawTitle },
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
    }

    return NextResponse.json(
      { error: "Unsupported action" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Failed to update conversation:", err);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

// Permanently deletes a conversation. Messages are removed via
// the Prisma relation onDelete behaviour configured in the schema.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.conversation.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("Failed to delete conversation:", err);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
