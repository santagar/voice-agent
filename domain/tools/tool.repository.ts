import { prisma } from "../../lib/prisma";

export type ToolRecord = {
  id: string;
  name: string;
  kind: "business" | "session";
  definitionJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  status: string;
};

export async function findActiveTools(): Promise<ToolRecord[]> {
  return prisma.tool.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  }) as unknown as ToolRecord[];
}

export async function findAssistantTools(assistantId: string) {
  return prisma.assistantTool.findMany({
    where: { assistantId, enabled: true, tool: { status: "active" } },
    include: { tool: true },
    orderBy: { createdAt: "asc" },
  });
}
