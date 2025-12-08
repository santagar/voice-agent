import { prisma } from "../../lib/prisma";

export async function fetchActiveSanitizationRules() {
  return prisma.sanitizationRule.findMany({
    where: { status: "active", direction: { in: ["out", "both"] } },
    orderBy: { createdAt: "asc" },
  });
}
