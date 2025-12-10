import { useEffect, useRef } from "react";
import type { ScopeDefinition } from "./realtimeTypes.ts";

type TranscriptionOptions = {
  useVoiceTranscribe: boolean;
  minUtteranceSamples: number;
  currentScope: string;
  setCurrentScope: (scope: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  pushSystem: (text: string, meta?: string) => void;
};

/**
 * Handles transcription and optional intent classification for user utterances.
 */
export function fallbackScopeDetection(
  text: string,
  scopeCatalog: ScopeDefinition[]
) {
  const lower = text.toLowerCase();
  for (const rule of scopeCatalog) {
    if (rule.keywords.some((kw) => kw && lower.includes(kw))) {
      return rule.name;
    }
  }
  return null;
}

export function useTranscriptionIntent({
  useVoiceTranscribe,
  minUtteranceSamples,
  currentScope,
  setCurrentScope,
  setMessages,
  pushSystem,
}: TranscriptionOptions) {
  const currentScopeRef = useRef(currentScope);

  useEffect(() => {
    currentScopeRef.current = currentScope;
  }, [currentScope]);

  async function detectScopeViaVectors(text: string) {
    try {
      const res = await fetch("/api/scope/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.scope === "string" ? data.scope : null;
    } catch (err) {
      console.warn("Scope detection via vectors failed:", err);
      return null;
    }
  }

  async function classifyIntent(text: string) {
    try {
      const intentRes = await fetch("/api/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const intentJson = await intentRes.json();
      return intentJson.intent as string | undefined;
    } catch (err) {
      console.error("Failed to classify intent:", err);
      return undefined;
    }
  }

  async function updateScope(text: string, scopeCatalog: ScopeDefinition[]) {
    let nextScope = currentScopeRef.current;
    if (scopeCatalog.length) {
      const lower = text.toLowerCase();
      const matched = scopeCatalog.find((scope) =>
        scope.keywords.some((kw) => lower.includes(kw.toLowerCase()))
      );
      if (matched) {
        nextScope = matched.name;
      }
    }
    try {
      const scopeRes = await fetch("/api/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const scopeJson = await scopeRes.json();
      if (scopeJson?.scope) {
        nextScope = scopeJson.scope as string;
      }
    } catch (err) {
      console.warn("Scope update failed:", err);
    }
    if (nextScope !== currentScope) {
      setCurrentScope(nextScope);
    }
    return nextScope;
  }

  // fallbackScopeDetection is exported at module level for testing

  async function autoDetectScope(
    text: string,
    scopeCatalog: ScopeDefinition[]
  ) {
    const trimmed = text.trim();
    if (!trimmed) {
      return currentScopeRef.current;
    }
    const vectorScope = await detectScopeViaVectors(trimmed);
    let nextScope = vectorScope;
    if (!nextScope) {
      nextScope = fallbackScopeDetection(trimmed, scopeCatalog);
    }
    if (!nextScope) {
      return currentScopeRef.current;
    }
    if (nextScope !== currentScopeRef.current) {
      setCurrentScope(nextScope);
      pushSystem(`Scope auto-detected: ${nextScope}`, "scope");
    }
    return nextScope;
  }

  async function transcribeUserUtterance(
    pcm16: Int16Array,
    opts: {
      messageId?: string | null;
      scopeCatalog: ScopeDefinition[];
    }
  ) {
    if (!useVoiceTranscribe) return { transcript: "", nextScope: currentScope };

    if (pcm16.length < minUtteranceSamples) {
      return { transcript: "", nextScope: currentScope };
    }

    try {
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(pcm16.buffer))
      );

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio }),
      });
      const json = await res.json();
      const transcript =
        typeof json.text === "string" ? json.text.trim() : "";

      const intent = transcript.length <= 1 ? "USER_TURN" : await classifyIntent(transcript);
      if (intent === "IGNORE") {
        pushSystem("Ignoring low-intent voice segment.", "info");
        if (opts.messageId) {
          setMessages((prev) => prev.filter((m) => m.id !== opts.messageId));
        }
        return { transcript: "", nextScope: currentScopeRef.current };
      }

      const nextScope = await updateScope(transcript, opts.scopeCatalog);
      return { transcript, nextScope };
    } catch (err) {
      console.error("Failed to transcribe user utterance:", err);
      return { transcript: "", nextScope: currentScopeRef.current };
    }
  }

  return { transcribeUserUtterance, autoDetectScope };
}
