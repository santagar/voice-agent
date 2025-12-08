"use client";

type FetchLike = typeof fetch;

export function useApiConfig(fetchImpl: FetchLike = fetch) {
  async function fetchInstructions() {
    const res = await fetchImpl("/api/config/instructions");
    if (!res.ok) throw new Error("Failed to load instructions");
    return res.json();
  }

  async function fetchTools() {
    const res = await fetchImpl("/api/config/tools");
    if (!res.ok) throw new Error("Failed to load tools");
    return res.json();
  }

  async function fetchSanitize() {
    const res = await fetchImpl("/api/config/sanitize");
    if (!res.ok) throw new Error("Failed to load sanitize rules");
    return res.json();
  }

  return {
    fetchInstructions,
    fetchTools,
    fetchSanitize,
  };
}
