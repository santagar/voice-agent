import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
    };
    const query =
      typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }
    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 100
        ? body.limit
        : 30;

    const messages = await prisma.message.findMany({
      where: {
        text: { contains: query },
        conversation: { userId },
      },
      include: {
        conversation: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const seen = new Set<string>();
    const results = messages
      .filter((m) => {
        if (!m.conversation) return false;
        if (seen.has(m.conversationId)) return false;
        seen.add(m.conversationId);
        return true;
      })
      .map((m) => ({
        conversationId: m.conversationId,
        title: m.conversation?.title ?? "Untitled",
        lastMessageAt: m.conversation?.updatedAt?.toISOString?.() ?? null,
        snippet: m.text ?? "",
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Failed to search conversations:", err);
    return NextResponse.json(
      { error: "Failed to search conversations", results: [] },
      { status: 500 }
    );
  }
}
