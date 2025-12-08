"use client";

type FetchLike = typeof fetch;

export function useApiTranscribe(fetchImpl: FetchLike = fetch) {
  const transcribe = async (base64Audio: string): Promise<string | null> => {
    const res = await fetchImpl("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: base64Audio }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    const transcript = (data.text || "").trim();
    return transcript || null;
  };

  return { transcribe };
}
