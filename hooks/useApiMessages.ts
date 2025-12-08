"use client";

type FetchLike = typeof fetch;

export type AppendMessagePayload = {
  from: string;
  text: string;
  meta?: Record<string, unknown>;
};

export function useApiMessages(fetchImpl: FetchLike = fetch) {
  async function appendMessage(
    conversationId: string,
    payload: AppendMessagePayload
  ): Promise<boolean> {
    const res = await fetchImpl(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  }

  return { appendMessage };
}
