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

    const assistant = await prisma.assistant.findUnique({
      where: { id },
    });

    if (!assistant) {
      return NextResponse.json(
        { error: "Assistant not found" },
        { status: 404 }
      );
    }

    const [
      allInstructions,
      instructionBindings,
      allTools,
      toolBindings,
      allRules,
      ruleBindings,
    ] = await Promise.all([
      prisma.instruction.findMany({
        where: {
          status: "active",
          OR: [
            { assistantId: id },
            { assistantBindings: { some: { assistantId: id } } },
          ],
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.assistantInstruction.findMany({
        where: { assistantId: id },
      }),
      prisma.tool.findMany({
        where: {
          status: "active",
          OR: [
            // Tools creadas específicamente para este asistente
            { assistantId: id },
            // Tools enlazadas mediante la tabla de bindings
            { assistantBindings: { some: { assistantId: id } } },
          ],
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.assistantTool.findMany({
        where: { assistantId: id },
      }),
      prisma.sanitizationRule.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.assistantSanitizationRule.findMany({
        where: { assistantId: id },
      }),
    ]);

    const instructions = allInstructions.map((inst) => {
      const binding = instructionBindings.find(
        (b) => b.instructionId === inst.id
      );
      return {
        id: inst.id,
        type: inst.type,
        label: inst.label,
        lines: inst.lines,
        enabled: binding ? binding.enabled : false,
        sortOrder: binding?.sortOrder ?? 0,
      };
    });

    const tools = allTools.map((tool) => {
      const binding = toolBindings.find((b) => b.toolId === tool.id);
      const def: any = tool.definitionJson || {};
      const displayName =
        typeof def.name === "string" && def.name.trim()
          ? def.name.trim()
          : tool.name;
      const descriptionFromDef =
        typeof def.description === "string" && def.description.trim()
          ? def.description.trim()
          : null;
      return {
        id: tool.id,
        name: displayName,
        kind: tool.kind,
        description: descriptionFromDef,
        enabled: binding ? binding.enabled : false,
        owned: tool.assistantId === id,
      };
    });

    const sanitize = allRules.map((rule) => {
      const binding = ruleBindings.find((b) => b.ruleId === rule.id);
      return {
        id: rule.id,
        description: rule.description,
        direction: rule.direction,
        enabled: binding ? binding.enabled : false,
        sortOrder: binding?.sortOrder ?? 0,
      };
    });

    return NextResponse.json({
      assistant: {
        id: assistant.id,
        name: assistant.name,
        description: assistant.description,
        updatedAt: assistant.updatedAt.toISOString(),
      },
      instructions,
      tools,
      sanitize,
    });
  } catch (err: any) {
    console.error("Failed to load assistant config:", err);
    return NextResponse.json(
      { error: "Failed to load assistant config" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id: assistantId } = await params;

    const assistant = await prisma.assistant.findUnique({
      where: { id: assistantId },
    });
    if (!assistant) {
      return NextResponse.json(
        { error: "Assistant not found" },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      instructions?: { id: string; enabled: boolean; sortOrder?: number }[];
      tools?: { id: string; enabled: boolean }[];
      sanitize?: { id: string; enabled: boolean; sortOrder?: number }[];
      assistant?: {
        name?: string;
        description?: string | null;
      };
    };

    const ops: Promise<unknown>[] = [];

    if (body.assistant && (body.assistant.name || body.assistant.description !== undefined)) {
      const updateData: { name?: string; description?: string | null } = {};
      if (typeof body.assistant.name === "string" && body.assistant.name.trim()) {
        updateData.name = body.assistant.name.trim();
      }
      if (body.assistant.description !== undefined) {
        updateData.description =
          body.assistant.description === null
            ? null
            : String(body.assistant.description);
      }
      if (Object.keys(updateData).length > 0) {
        ops.push(
          prisma.assistant.update({
            where: { id: assistantId },
            data: updateData,
          })
        );
      }
    }

    if (Array.isArray(body.instructions)) {
      for (const item of body.instructions) {
        if (!item?.id) continue;
        const instructionId = item.id;
        const enabled = Boolean(item.enabled);
        const sortOrder = Number.isFinite(item.sortOrder)
          ? (item.sortOrder as number)
          : 0;

        ops.push(
          prisma.assistantInstruction.upsert({
            where: {
              assistantId_instructionId: {
                assistantId,
                instructionId,
              },
            },
            update: {
              enabled,
              sortOrder,
            },
            create: {
              assistantId,
              instructionId,
              enabled,
              sortOrder,
            },
          })
        );
      }
    }

    if (Array.isArray(body.tools)) {
      for (const item of body.tools) {
        if (!item?.id) continue;
        const toolId = item.id;
        const enabled = Boolean(item.enabled);

        ops.push(
          prisma.assistantTool.upsert({
            where: {
              assistantId_toolId: {
                assistantId,
                toolId,
              },
            },
            update: {
              enabled,
            },
            create: {
              assistantId,
              toolId,
              enabled,
            },
          })
        );
      }
    }

    if (Array.isArray(body.sanitize)) {
      for (const item of body.sanitize) {
        if (!item?.id) continue;
        const ruleId = item.id;
        const enabled = Boolean(item.enabled);
        const sortOrder = Number.isFinite(item.sortOrder)
          ? (item.sortOrder as number)
          : 0;

        ops.push(
          prisma.assistantSanitizationRule.upsert({
            where: {
              assistantId_ruleId: {
                assistantId,
                ruleId,
              },
            },
            update: {
              enabled,
              sortOrder,
            },
            create: {
              assistantId,
              ruleId,
              enabled,
              sortOrder,
            },
          })
        );
      }
    }

    if (ops.length) {
      await Promise.all(ops);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Failed to update assistant config:", err);
    return NextResponse.json(
      { error: "Failed to update assistant config" },
      { status: 500 }
    );
  }
}
