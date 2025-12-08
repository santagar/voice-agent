import { Prisma } from "@prisma/client";
import {
  createToolCallRecord,
  createToolCallSystemMessage,
  fetchLastMessageSequence,
  touchConversationUpdatedAt,
  updateToolCallRecord,
} from "./toolCall.repository";

export async function startToolCall(params: {
  conversationId: string;
  toolId?: string | null;
  name: string;
  inputJson?: Prisma.InputJsonValue;
}): Promise<string | null> {
  try {
    const created = await createToolCallRecord(params);
    return created.id;
  } catch (err) {
    console.error("Failed to persist ToolCall start:", err);
    return null;
  }
}

export async function completeToolCall(params: {
  id: string;
  status: "succeeded" | "failed";
  resultJson?: Prisma.InputJsonValue | null;
  error?: string | null;
}): Promise<void> {
  try {
    await updateToolCallRecord(params);
  } catch (err) {
    console.error("Failed to persist ToolCall update:", err);
  }
}

export async function appendToolCallMessage(params: {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  status: string;
}): Promise<void> {
  const { conversationId, toolCallId, toolName, status } = params;
  try {
    const lastSequence = await fetchLastMessageSequence(conversationId);
    const nextSequence = lastSequence + 1;
    await createToolCallSystemMessage({
      conversationId,
      toolCallId,
      toolName,
      status,
      sequence: nextSequence,
    });
    await touchConversationUpdatedAt(conversationId);
  } catch (err) {
    console.error("Failed to persist ToolCall message:", err);
  }
}
