import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbTools = await prisma.tool.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
    });

    const tools = dbTools.map((tool) => {
      const def: any = tool.definitionJson || {};
      return {
        name: tool.name,
        kind: tool.kind,
        description: tool.description || "",
        parameters: def.parameters,
        routes: def.routes,
        ui_command: def.ui_command,
        session_update: def.session_update,
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
