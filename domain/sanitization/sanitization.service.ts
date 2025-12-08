import { fetchActiveSanitizationRules } from "./sanitization.repository";

export type SanitizationRuleConfig = {
  description?: string;
  pattern: string;
  flags?: string;
  replacement?: string;
};

export async function loadActiveSanitizationRules(): Promise<SanitizationRuleConfig[]> {
  const rules = await fetchActiveSanitizationRules();
  return rules.map((rule) => ({
    description: rule.description || undefined,
    pattern: rule.pattern,
    flags: rule.flags || "g",
    replacement: rule.replacement,
  }));
}
