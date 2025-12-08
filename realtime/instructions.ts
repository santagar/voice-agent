import { PrismaClient } from "@prisma/client";
import { StructuredLogger } from "./logger";

export type ProfileSections = Record<string, string[]>;

export function buildSessionInstructions(profile: ProfileSections) {
  const sections: string[] = [];
  const keys = Object.keys(profile || {});

  for (const key of keys) {
    const value = profile[key];
    if (!Array.isArray(value) || !value.length) continue;

    sections.push(key.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase()));
    for (const line of value) {
      sections.push(String(line));
    }
    sections.push("");
  }

  return sections
    .filter((line, idx, arr) => {
      if (line !== "") return true;
      if (idx === 0) return false;
      return idx !== arr.length - 1;
    })
    .join("\n")
    .trim();
}

export async function loadGlobalInstructions(
  prisma: PrismaClient,
  logger: StructuredLogger
) {
  try {
    const instructions = await prisma.instruction.findMany({
      where: {
        status: "active",
        assistantId: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!instructions.length) {
      logger.info("instructions.global.empty", {});
      return "";
    }

    const profileObj: Record<string, string[]> = {};
    for (const inst of instructions) {
      const lines = (inst.lines as unknown) as string[] | null;
      profileObj[inst.type] = Array.isArray(lines) ? lines : [];
    }

    const built = buildSessionInstructions(profileObj);
    logger.info("instructions.global.loaded", { blocks: instructions.length });
    return built;
  } catch (err) {
    logger.error("instructions.global.load_failed", {
      error: (err as Error)?.message || String(err),
    });
    return "";
  }
}

export async function buildSessionInstructionsForAssistant(
  prisma: PrismaClient,
  assistantId: string | null,
  logger: StructuredLogger
): Promise<string> {
  if (!assistantId) return "";

  try {
    const bindings = await prisma.assistantInstruction.findMany({
      where: {
        assistantId,
        enabled: true,
        instruction: { status: "active" },
      },
      include: {
        instruction: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    if (!bindings.length) {
      return "";
    }

    const profileObj: Record<string, string[]> = {};
    for (const binding of bindings) {
      const inst = binding.instruction;
      if (!inst) continue;
      const lines = (inst.lines as unknown) as string[] | null;
      profileObj[inst.type] = Array.isArray(lines) ? lines : [];
    }

    return buildSessionInstructions(profileObj);
  } catch (err) {
    logger.error("instructions.assistant.load_failed", {
      assistantId,
      error: (err as Error)?.message || String(err),
    });
    return "";
  }
}
