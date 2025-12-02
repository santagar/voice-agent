import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      label?: string | null;
      lines?: string[];
      status?: string;
      assistantId?: string | null;
      ownerId?: string | null;
    };

    const type =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim()
        : null;
    if (!type) {
      return NextResponse.json(
        { error: "type is required" },
        { status: 400 }
      );
    }

    const assistantId =
      typeof body.assistantId === "string" && body.assistantId.trim()
        ? body.assistantId.trim()
        : null;
    const ownerId =
      typeof body.ownerId === "string" && body.ownerId.trim()
        ? body.ownerId.trim()
        : null;

    const linesArray = Array.isArray(body.lines)
      ? body.lines.map((line) => String(line))
      : [];

    const baseData = {
      label:
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim()
          : null,
      lines: linesArray,
      status:
        typeof body.status === "string" && body.status.trim()
          ? body.status.trim()
          : "active",
    } as const;

    let instruction;

    if (assistantId) {
      const existing = await prisma.instruction.findFirst({
        where: {
          assistantId,
          type,
        },
      });

      if (existing) {
        instruction = await prisma.instruction.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            assistantId,
            ownerId,
          },
        });
      } else {
        instruction = await prisma.instruction.create({
          data: {
            ...baseData,
            type,
            assistantId,
            ownerId,
          },
        });
      }
    } else if (ownerId) {
      const existing = await prisma.instruction.findFirst({
        where: {
          ownerId,
          type,
        },
      });

      if (existing) {
        instruction = await prisma.instruction.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            ownerId,
            assistantId: null,
          },
        });
      } else {
        instruction = await prisma.instruction.create({
          data: {
            ...baseData,
            type,
            ownerId,
          },
        });
      }
    } else {
      instruction = await prisma.instruction.create({
        data: {
          ...baseData,
          type,
        },
      });
    }

    return NextResponse.json({
      instruction: {
        id: instruction.id,
        type: instruction.type,
        label: instruction.label,
        lines: instruction.lines,
        status: instruction.status,
      },
    });
  } catch (err: any) {
    console.error("Failed to create instruction:", err);
    return NextResponse.json(
      { error: "Failed to create instruction" },
      { status: 500 }
    );
  }
}
