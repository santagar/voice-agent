"use client";

type FetchLike = typeof fetch;

export function useApiVoiceIntent(fetchImpl: FetchLike = fetch) {
  const classifyIntent = async (text: string): Promise<string | null> => {
    const res = await fetchImpl("/api/voice-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { decision?: string };
    const decision = String(json.decision || "").trim();
    return decision ? decision.toUpperCase() : null;
  };

  return { classifyIntent };
}
