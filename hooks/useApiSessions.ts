"use client";

type FetchLike = typeof fetch;

type SessionPayload = {
  session?: {
    id: string;
    status?: string;
    assistantId?: string;
    conversationId?: string | null;
    userId?: string | null;
  };
};

export function useApiSessions(fetchImpl: FetchLike = fetch) {
  async function createSession(params: {
    assistantId: string;
    userId?: string | null;
    conversationId?: string | null;
    channel?: string;
    assistantConfig?: unknown;
  }): Promise<string | null> {
    const res = await fetchImpl("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: params.assistantId,
        userId: params.userId ?? null,
        conversationId: params.conversationId ?? null,
        channel: params.channel ?? "web",
        assistantConfig: params.assistantConfig ?? null,
      }),
    });
    if (!res.ok) return null;
    const data: SessionPayload = await res.json().catch(() => ({}));
    return data.session?.id ?? null;
  }

  return {
    createSession,
    updateSession: async (
      sessionId: string,
      data: {
        status?: "closed" | "expired" | "active";
        conversationId?: string | null;
        userId?: string | null;
      }
    ) => {
      const res = await fetchImpl(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok;
    },
  };
}
