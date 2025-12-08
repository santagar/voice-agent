import { prisma } from "../../lib/prisma";

export async function findAllInstructionBlocks() {
  return prisma.instruction.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });
}

export async function findAssistantInstructionBlocks(assistantId: string) {
  return prisma.assistantInstruction.findMany({
    where: {
      assistantId,
      enabled: true,
      instruction: { status: "active" },
    },
    include: {
      instruction: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
