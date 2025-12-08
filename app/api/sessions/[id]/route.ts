import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const status = body?.status as string | undefined;
    const conversationId =
      body && "conversationId" in body ? body.conversationId ?? null : undefined;
    const userId = body && "userId" in body ? body.userId ?? null : undefined;

    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      if (status !== "closed" && status !== "expired" && status !== "active") {
        return NextResponse.json(
          { error: "status must be 'closed' or 'expired' or 'active'" },
          { status: 400 }
        );
      }
      updates.status = status;
    }
    if (conversationId !== undefined) {
      updates.conversationId = conversationId;
    }
    if (userId !== undefined) {
      updates.userId = userId;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

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
