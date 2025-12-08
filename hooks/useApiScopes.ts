"use client";

export type ScopeDefinition = {
  name: string;
  keywords?: string[];
};

type FetchLike = typeof fetch;

export function useApiScopes(fetchImpl: FetchLike = fetch) {
  const listScopes = async (): Promise<ScopeDefinition[]> => {
    const res = await fetchImpl("/api/scopes");
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.scopes)) return [];
    return data.scopes as ScopeDefinition[];
  };

  const detectScope = async (text: string): Promise<string | null> => {
    const res = await fetchImpl("/api/scopes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.scope === "string" ? data.scope : null;
  };

  return { listScopes, detectScope };
}
