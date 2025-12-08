"use client";

type FetchLike = typeof fetch;

export function useApiAssistants(fetchImpl: FetchLike = fetch) {
  async function fetchAssistantConfig(assistantId: string) {
    const res = await fetchImpl(`/api/assistants/${assistantId}/config`);
    if (!res.ok) throw new Error("Failed to load assistant configuration");
    return res.json();
  }

  return {
    fetchAssistantConfig,
  };
}
