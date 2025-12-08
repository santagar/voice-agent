import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export async function createToolCallRecord(params: {
  conversationId: string;
  toolId?: string | null;
  name: string;
  inputJson?: Prisma.InputJsonValue;
}) {
  const { conversationId, toolId, name, inputJson } = params;
  return prisma.toolCall.create({
    data: {
      conversationId,
      toolId: toolId ?? undefined,
      name,
      status: "started",
      inputJson: inputJson ?? {},
    },
  });
}

export async function updateToolCallRecord(params: {
  id: string;
  status: "succeeded" | "failed";
  resultJson?: Prisma.InputJsonValue | null;
  error?: string | null;
}) {
  const { id, status, resultJson, error } = params;
  const safeResult =
    resultJson === null ? Prisma.JsonNull : (resultJson ?? undefined);

  return prisma.toolCall.update({
    where: { id },
    data: {
      status,
      resultJson: safeResult,
      completedAt: new Date(),
      error: error ?? null,
    },
  });
}

export async function fetchLastMessageSequence(conversationId: string) {
  const last = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { sequence: "desc" },
  });
  return last?.sequence ?? 0;
}

export async function createToolCallSystemMessage(params: {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  status: string;
  sequence: number;
}) {
  const { conversationId, toolCallId, toolName, status, sequence } = params;
  return prisma.message.create({
    data: {
      conversationId,
      from: "system",
      text: `Tool call ${toolName} (${status})`,
      sequence,
      toolCallId,
      meta: {
        turnType: "tool_call",
        toolName,
        toolStatus: status,
      },
    },
  });
}

export async function touchConversationUpdatedAt(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
