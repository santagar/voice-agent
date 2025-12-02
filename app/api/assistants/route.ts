import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      workspaceId?: string;
      userId?: string | null;
      name?: string | null;
      description?: string | null;
    };

    const workspaceId =
      typeof body.workspaceId === "string" && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : null;
    const userId =
      typeof body.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : null;

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: "workspaceId and userId are required" },
        { status: 400 }
      );
    }

    const rawName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Untitled assistant";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    const baseSlug = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const slug = `${baseSlug || "assistant"}-${randomSuffix}`;

    const assistant = await prisma.assistant.create({
      data: {
        name: rawName,
        description,
        slug,
        status: "active",
        workspaceId,
        ownerId: userId,
      },
    });

    return NextResponse.json(
      {
        assistant: {
          id: assistant.id,
          name: assistant.name,
          description: assistant.description,
          createdAt: assistant.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Failed to create assistant:", err);
    return NextResponse.json(
      { error: "Failed to create assistant" },
      { status: 500 }
    );
  }
}

