"use client";

type FetchLike = typeof fetch;

type ConversationPayload = {
  conversation?: any;
  messages?: any;
  [key: string]: unknown;
};

export function useApiConversations(fetchImpl: FetchLike = fetch) {
  function rawFetch(input: RequestInfo | URL, init?: RequestInit) {
    return fetchImpl(input, init);
  }

  async function getConversationById(
    id: string,
    init?: RequestInit
  ): Promise<{
    ok: boolean;
    status: number;
    conversation?: ConversationPayload["conversation"];
    messages?: ConversationPayload["messages"];
  }> {
    const res = await fetchImpl(`/api/conversations/${id}`, init);
    let data: ConversationPayload | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      conversation: data?.conversation,
      messages: data?.messages,
    };
  }

  async function listConversations() {
    const res = await fetchImpl("/api/conversations");
    if (!res.ok) throw new Error("Failed to load conversations");
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.conversations) ? data.conversations : [];
  }

  async function createConversation(params: {
    title: string;
    mode: string;
    userId: string | null;
    assistantId: string | null;
    workspaceId: string | null;
  }): Promise<any | null> {
    const res = await fetchImpl("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.conversation ?? null;
  }

  async function archiveConversation(conversationId: string): Promise<boolean> {
    const res = await fetchImpl(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    return res.ok;
  }

  async function deleteConversation(conversationId: string): Promise<boolean> {
    const res = await fetchImpl(`/api/conversations/${conversationId}`, {
      method: "DELETE",
    });
    return res.ok || res.status === 204;
  }

  async function renameConversation(
    conversationId: string,
    nextTitle: string
  ): Promise<boolean> {
    const trimmed = nextTitle.trim();
    if (!trimmed) return false;
    const res = await fetchImpl(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", title: trimmed }),
    });
    return res.ok;
  }

  async function searchConversations(query: string) {
    const res = await fetchImpl("/api/conversations/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      console.warn("Failed to search conversations:", res.status);
      return [];
    }
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.results) ? data.results : [];
  }

  return {
    listConversations,
    createConversation,
    archiveConversation,
    deleteConversation,
    renameConversation,
    searchConversations,
    rawFetch,
    getConversationById,
  };
}
