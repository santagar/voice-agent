import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbTools = await prisma.tool.findMany({
      where: {
        status: "active",
        assistantId: null,
      },
      orderBy: { createdAt: "asc" },
    });

    const tools = dbTools.map((tool) => {
      const def: any = tool.definitionJson || {};
      const descriptionFromDef =
        typeof def.description === "string" && def.description.trim()
          ? def.description.trim()
          : "";
      return {
        name: tool.name,
        kind: tool.kind,
        description: descriptionFromDef,
        definition: def,
      };
    });

    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error("Failed to load tools from database:", err);
    return NextResponse.json(
      { error: "Failed to load tools" },
      { status: 500 }
    );
  }
}
