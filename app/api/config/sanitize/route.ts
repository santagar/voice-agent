import { NextResponse } from "next/server";
import sanitizeFile from "@/config/sanitize.json";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = await prisma.sanitizationRule.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
    });

    if (!rules.length) {
      return NextResponse.json({ sanitize: sanitizeFile });
    }

    const sanitize = rules.map((rule) => ({
      id: rule.id,
      description: rule.description || undefined,
      pattern: rule.pattern,
      flags: rule.flags || "g",
      replacement: rule.replacement,
      direction: rule.direction,
    }));

    return NextResponse.json({ sanitize });
  } catch (err: any) {
    console.error("Failed to load sanitize rules from database:", err);
    return NextResponse.json(
      { error: "Failed to load sanitize rules" },
      { status: 500 }
    );
  }
}
