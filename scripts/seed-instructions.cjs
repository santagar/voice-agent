// scripts/seed-instructions.cjs
// Seeds Instruction rows from config/profile.json.
// Each array-valued key becomes one Instruction with `type` = key
// and `lines` = array of strings.
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const profilePath = path.join(process.cwd(), "config", "profile.json");
  const profile = require(profilePath);

  const entries = Object.entries(profile || {}).filter(
    ([, value]) => Array.isArray(value) && value.length > 0
  );

  if (!entries.length) {
    console.log(
      "No array-valued keys found in config/profile.json; nothing to seed."
    );
    return;
  }

  console.log(
    `Seeding ${entries.length} instruction blocks from config/profile.json ...`
  );

  for (const [type, lines] of entries) {
    await prisma.instruction.upsert({
      where: { type },
      update: {
        label: type,
        lines,
        status: "active",
      },
      create: {
        type,
        label: type,
        lines,
        status: "active",
      },
    });

    console.log(`  • Upserted instruction block: ${type}`);
  }

  console.log("✅ Instruction seeding completed.");
}

main()
  .catch((err) => {
    console.error("Failed to seed instructions:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
