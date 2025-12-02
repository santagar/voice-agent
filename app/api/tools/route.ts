import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      assistantId?: string | null;
      ownerId?: string | null;
      definition?: any;
      templateName?: string | null;
      kind?: string | null;
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

    const ownerId =
      typeof body.ownerId === "string" && body.ownerId.trim()
        ? body.ownerId.trim()
        : null;

    let tool;

    if (body.definition && typeof body.definition === "object") {
      const def = body.definition as {
        name?: string;
      };

      const baseName =
        typeof def.name === "string" && def.name.trim()
          ? def.name.trim()
          : null;
      if (!baseName) {
        return NextResponse.json(
          { error: "definition.name is required for owned tools" },
          { status: 400 }
        );
      }
      const name = baseName;

      const kind =
        typeof body.kind === "string" && body.kind.trim()
          ? body.kind.trim()
          : "business";

      tool = await prisma.tool.create({
        data: {
          name,
          type: "function",
          kind,
          definitionJson: body.definition,
          status: "active",
          ownerId,
          assistantId,
        },
      });
    } else if (
      typeof body.templateName === "string" &&
      body.templateName.trim()
    ) {
      const templateName = body.templateName.trim();
      const template = await prisma.tool.findFirst({
        where: {
          name: templateName,
          assistantId: null,
          status: "active",
        },
      });
      if (!template) {
        return NextResponse.json(
          { error: "Template tool not found" },
          { status: 404 }
        );
      }

      const def: any = template.definitionJson || {};

      const baseName =
        typeof template.name === "string" && template.name.trim()
          ? template.name.trim()
          : templateName;

      // We keep the human-facing function name inside the JSON
      // definition (`def.name`). The `Tool.name` column is only
      // required to be unique and is not shown in the editor, so we
      // generate a stable-but-opaque identifier per assistant.
      tool = await prisma.tool.create({
        data: {
          name: baseName,
          type: "function",
          kind: template.kind,
          definitionJson: def,
          status: "active",
          ownerId,
          assistantId,
        },
      });
    } else {
      return NextResponse.json(
        { error: "definition or templateName is required" },
        { status: 400 }
      );
    }

    await prisma.assistantTool.upsert({
      where: {
        assistantId_toolId: {
          assistantId,
          toolId: tool.id,
        },
      },
      update: {
        enabled: true,
      },
      create: {
        assistantId,
        toolId: tool.id,
        enabled: true,
      },
    });

    const def: any = tool.definitionJson || {};
    const descriptionFromDef =
      typeof def.description === "string" && def.description.trim()
        ? def.description.trim()
        : null;

    return NextResponse.json({
      tool: {
        id: tool.id,
        name: tool.name,
        kind: tool.kind,
        description: descriptionFromDef,
        enabled: true,
      },
    });
  } catch (err: any) {
    console.error("Failed to create or bind tool:", err);
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
      { error: "Failed to create or bind tool" },
      { status: 500 }
    );
  }
}
