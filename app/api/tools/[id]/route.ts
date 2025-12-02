import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const tool = await prisma.tool.findUnique({
      where: { id },
    });

    if (!tool) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }

    const def: any = tool.definitionJson || {};

    return NextResponse.json({
      tool: {
        id: tool.id,
        name: tool.name,
        kind: tool.kind,
        description:
          typeof (def as any).description === "string"
            ? (def as any).description
            : null,
        assistantId: tool.assistantId,
        definition: def,
      },
    });
  } catch (err: any) {
    console.error("Failed to load tool:", err);
    return NextResponse.json(
      { error: "Failed to load tool" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      definition?: any;
      assistantId?: string | null;
      kind?: string | null;
    };

    if (!body.definition || typeof body.definition !== "object") {
      return NextResponse.json(
        { error: "definition is required" },
        { status: 400 }
      );
    }

    const assistantId =
      typeof body.assistantId === "string" && body.assistantId.trim()
        ? body.assistantId.trim()
        : null;
    if (!assistantId) {
      return NextResponse.json(
        { error: "assistantId is required" },
        { status: 400 }
      );
    }

    const tool = await prisma.tool.findUnique({
      where: { id },
    });

    if (!tool) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }

    if (tool.assistantId !== assistantId) {
      return NextResponse.json(
        { error: "Only owned tools can be updated" },
        { status: 403 }
      );
    }

    const updateData: {
      definitionJson: any;
      kind?: string;
      name?: string;
    } = {
      definitionJson: body.definition,
    };

    const def = body.definition as { name?: string };
    const baseName =
      typeof def.name === "string" && def.name.trim()
        ? def.name.trim()
        : null;
    if (baseName) {
      updateData.name = baseName;
    }

    if (typeof body.kind === "string" && body.kind.trim()) {
      updateData.kind = body.kind.trim();
    }

    const updated = await prisma.tool.update({
      where: { id },
      data: updateData,
    });

    const updatedDef: any = updated.definitionJson || {};
    const updatedDescription =
      typeof updatedDef.description === "string"
        ? updatedDef.description
        : null;

    return NextResponse.json({
      tool: {
        id: updated.id,
        name: updated.name,
        kind: updated.kind,
        description: updatedDescription,
      },
    });
  } catch (err: any) {
    console.error("Failed to update tool:", err);
    if (err?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "A function with this name already exists for this assistant. Please choose a different name.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update tool" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      assistantId?: string | null;
    };

    const assistantId =
      typeof body.assistantId === "string" && body.assistantId.trim()
        ? body.assistantId.trim()
        : null;

    if (!assistantId) {
      return NextResponse.json(
        { error: "assistantId is required" },
        { status: 400 }
      );
    }

    const tool = await prisma.tool.findUnique({
      where: { id },
    });

    if (!tool) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }

    if (tool.assistantId === assistantId) {
      await prisma.tool.delete({
        where: { id },
      });
    } else {
      await prisma.assistantTool.deleteMany({
        where: {
          assistantId,
          toolId: id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Failed to delete or unbind tool:", err);
    return NextResponse.json(
      { error: "Failed to delete or unbind tool" },
      { status: 500 }
    );
  }
}
