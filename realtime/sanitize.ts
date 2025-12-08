import path from "path";
import { PrismaClient } from "@prisma/client";
import { StructuredLogger } from "./logger";

export type SanitizationRuleConfig = {
  description?: string;
  pattern: string;
  flags?: string;
  replacement?: string;
};

export type CompiledSanitizationRule = {
  description: string;
  replacement: string;
  regex: RegExp;
};

export function compileSanitizationRules(
  rules: SanitizationRuleConfig[]
): CompiledSanitizationRule[] {
  if (!Array.isArray(rules)) return [];

  const compiled: CompiledSanitizationRule[] = [];

  for (const rule of rules) {
    if (!rule?.pattern) continue;
    try {
      const flags =
        typeof rule.flags === "string" && rule.flags.length > 0
          ? rule.flags
          : "g";
      compiled.push({
        description: rule.description || "unnamed rule",
        replacement:
          typeof rule.replacement === "string" ? rule.replacement : "",
        regex: new RegExp(rule.pattern, flags),
      });
    } catch (err) {
      // Skip invalid rules but keep the server alive.
      // eslint-disable-next-line no-console
      console.error(`Invalid sanitization rule pattern "${rule.pattern}":`, err);
    }
  }

  return compiled;
}

export function createSanitizer(initialRules: SanitizationRuleConfig[]) {
  let compiled = compileSanitizationRules(initialRules);

  return {
    sanitize(text: string) {
      if (!text || typeof text !== "string") return text;
      let result = text;
      for (const rule of compiled) {
        result = result.replace(rule.regex, rule.replacement);
      }
      return result;
    },
    setRules(rules: SanitizationRuleConfig[]) {
      compiled = compileSanitizationRules(rules);
    },
    getCompiled() {
      return compiled;
    },
  };
}

// TODO: Remove file fallback once sanitization rules live only in the database.
export function loadDefaultSanitizeRules(
  rootDir: string
): SanitizationRuleConfig[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sanitize = require(path.join(rootDir, "config", "sanitize.json"));
    return sanitize as SanitizationRuleConfig[];
  } catch (err) {
    return [];
  }
}

export async function loadSanitizeRules(
  prisma: PrismaClient,
  defaultRules: SanitizationRuleConfig[],
  logger: StructuredLogger
): Promise<SanitizationRuleConfig[]> {
  try {
    const rules = await prisma.sanitizationRule.findMany({
      where: { status: "active", direction: { in: ["out", "both"] } },
      orderBy: { createdAt: "asc" },
    });

    if (!rules.length) {
      logger.info("sanitize.rules.fallback_json", {});
      return defaultRules;
    }

    logger.info("sanitize.rules.loaded", { count: rules.length });
    return rules.map((rule) => ({
      id: rule.id,
      description: rule.description || undefined,
      pattern: rule.pattern,
      flags: rule.flags || "g",
      replacement: rule.replacement,
    }));
  } catch (err) {
    logger.error("sanitize.rules.load_failed", {
      error: (err as Error)?.message || String(err),
    });
    return defaultRules;
  }
}
