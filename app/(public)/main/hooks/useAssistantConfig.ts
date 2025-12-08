"use client";

import { useEffect, useState } from "react";
import { useApiAssistants } from "@/hooks/useApiAssistants";
import { AssistantConfig } from "../../a/editor/components/AssistantSettingsPanel";

export function useAssistantConfig(activeAssistantId: string | null, viewMode: "chat" | "assistant-editor") {
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig | null>(null);
  const [assistantConfigLoading, setAssistantConfigLoading] = useState(false);
  const [assistantConfigError, setAssistantConfigError] = useState<string | null>(null);
  const { fetchAssistantConfig } = useApiAssistants();

  useEffect(() => {
    if (!activeAssistantId) {
      setAssistantConfig(null);
      setAssistantConfigError(null);
      setAssistantConfigLoading(false);
      return;
    }
    const assistantId = activeAssistantId;
    let cancelled = false;
    async function loadAssistantConfig() {
      try {
        setAssistantConfigLoading(true);
        setAssistantConfigError(null);
        const data = (await fetchAssistantConfig(assistantId)) as AssistantConfig;
        if (!cancelled) {
          setAssistantConfig(data);
        }
      } catch (err) {
        console.error("Failed to load assistant config:", err);
        if (!cancelled) {
          setAssistantConfigError("Failed to load assistant configuration.");
        }
      } finally {
        if (!cancelled) {
          setAssistantConfigLoading(false);
        }
      }
    }
    void loadAssistantConfig();
    return () => {
      cancelled = true;
    };
  }, [activeAssistantId, viewMode]);

  return { assistantConfig, assistantConfigLoading, assistantConfigError };
}
