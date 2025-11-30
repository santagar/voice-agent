// scripts/seed-sanitize.cjs
// Seeds SanitizationRule rows from config/sanitize.json.
// All rules default to direction = "out" (output only).
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const sanitizePath = path.join(process.cwd(), "config", "sanitize.json");
  const rules = require(sanitizePath);

  if (!Array.isArray(rules) || !rules.length) {
    console.log(
      "No sanitize rules found in config/sanitize.json; nothing to seed."
    );
    return;
  }

  console.log(
    `Seeding ${rules.length} sanitization rules from config/sanitize.json ...`
  );

  for (const rule of rules) {
    if (!rule?.pattern) continue;

    await prisma.sanitizationRule.create({
      data: {
        description: rule.description || null,
        pattern: rule.pattern,
        flags: rule.flags || "g",
        replacement:
          typeof rule.replacement === "string" ? rule.replacement : "",
        direction: "out",
        status: "active",
      },
    });
  }

  console.log("✅ SanitizationRule seeding completed.");
}

main()
  .catch((err) => {
    console.error("Failed to seed sanitization rules:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
