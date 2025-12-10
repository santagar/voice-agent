import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSessionSchema } from "../schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const parsed = updateSessionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { status, conversationId, userId } = parsed.data;

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (conversationId !== undefined) updates.conversationId = conversationId;
    if (userId !== undefined) updates.userId = userId;

    const session = await prisma.session.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json({ session });
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      // @ts-ignore prisma error
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    console.error("Failed to update session status:", err);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
