"use client";

import { useEffect, useState } from "react";
import { useApiConfig } from "@/hooks/useApiConfig";

export type SanitizeRule = { id?: string; replacement?: string; direction?: string };

export function useSanitizeRules() {
  const [sanitizeRules, setSanitizeRules] = useState<SanitizeRule[]>([]);
  const { fetchSanitize } = useApiConfig();

  useEffect(() => {
    let cancelled = false;
    async function loadSanitizeRules() {
      try {
        const data = await fetchSanitize();
        if (!Array.isArray(data.sanitize) || cancelled) return;
        setSanitizeRules(
          data.sanitize.map(
            (r: { id?: string; replacement?: string; direction?: string }) => ({
              id: typeof r.id === "string" ? r.id : undefined,
              replacement:
                typeof r.replacement === "string" ? r.replacement : undefined,
              direction: typeof r.direction === "string" ? r.direction : "out",
            })
          )
        );
      } catch {
        // best-effort only; sanitize meta is optional
      }
    }
    void loadSanitizeRules();
    return () => {
      cancelled = true;
    };
  // We intentionally avoid adding fetchSanitize to deps to prevent ref churn
  // from retriggering the effect unnecessarily.
  }, []);

  return { sanitizeRules };
}
