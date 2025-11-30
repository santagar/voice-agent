import { NextResponse } from "next/server";
import profileFile from "@/config/profile.json";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.instruction.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
    });

    if (!rows.length) {
      // Fallback to the original JSON structure:
      // keys (identity, tone_guidelines, etc.) → string[]
      return NextResponse.json({ instructions: profileFile });
    }

    // Reconstruct the same logical shape: type → string[].
    const instructions: Record<string, string[]> = {};
    for (const inst of rows) {
      const lines = (inst.lines as unknown) as string[] | null;
      instructions[inst.type] = Array.isArray(lines) ? lines : [];
    }

    return NextResponse.json({ instructions });
  } catch (err: any) {
    console.error("Failed to load instructions from database:", err);
    return NextResponse.json(
      { error: "Failed to load instructions" },
      { status: 500 }
    );
  }
}
