import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      label?: string | null;
      lines?: string[];
      status?: string;
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

    const linesArray = Array.isArray(body.lines)
      ? body.lines.map((line) => String(line))
      : [];

    const instruction = await prisma.instruction.create({
      data: {
        type,
        label:
          typeof body.label === "string" && body.label.trim()
            ? body.label.trim()
            : null,
        lines: linesArray,
        status:
          typeof body.status === "string" && body.status.trim()
            ? body.status.trim()
            : "active",
      },
    });

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

