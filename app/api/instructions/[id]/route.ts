import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      label?: string | null;
      lines?: string[];
      status?: string;
    };

    const data: {
      type?: string;
      label?: string | null;
      lines?: unknown;
      status?: string;
    } = {};

    if (typeof body.type === "string" && body.type.trim()) {
      data.type = body.type.trim();
    }
    if (body.label !== undefined) {
      data.label =
        body.label === null
          ? null
          : typeof body.label === "string"
          ? body.label.trim()
          : String(body.label);
    }
    if (Array.isArray(body.lines)) {
      data.lines = body.lines.map((line) => String(line));
    }
    if (typeof body.status === "string" && body.status.trim()) {
      data.status = body.status.trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const updated = await prisma.instruction.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      instruction: {
        id: updated.id,
        type: updated.type,
        label: updated.label,
        lines: updated.lines,
        status: updated.status,
      },
    });
  } catch (err: any) {
    console.error("Failed to update instruction:", err);
    return NextResponse.json(
      { error: "Failed to update instruction" },
      { status: 500 }
    );
  }
}

