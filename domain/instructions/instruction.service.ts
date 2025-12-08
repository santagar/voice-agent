import { InstructionProfile } from "./instruction.types";
import {
  findAllInstructionBlocks,
  findAssistantInstructionBlocks,
} from "./instruction.repository";

export async function loadGlobalInstructions(): Promise<InstructionProfile | null> {
  const blocks = await findAllInstructionBlocks();
  if (!blocks.length) return null;
  const profile: InstructionProfile = {};
  for (const block of blocks) {
    const name = (block as any).label || block.type || "default";
    const lines = Array.isArray(block.lines)
      ? (block.lines as unknown[]).map((l) => String(l))
      : [];
    profile[name] = lines;
  }
  return profile;
}

export async function loadAssistantInstructions(
  assistantId: string
): Promise<InstructionProfile | null> {
  const bindings = await findAssistantInstructionBlocks(assistantId);
  if (!bindings.length) return null;
  const profile: InstructionProfile = {};
  for (const binding of bindings) {
    const instr = (binding as any).instruction;
    if (!instr) continue;
    const name = instr.label || instr.type || "default";
    const lines = Array.isArray(instr.lines)
      ? (instr.lines as unknown[]).map((l: unknown) => String(l))
      : [];
    profile[name] = lines;
  }
  return profile;
}
