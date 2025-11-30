// scripts/seed-tools.cjs
require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const toolsConfig = require(path.join(process.cwd(), "config", "tools.json"));
  const tools = Array.isArray(toolsConfig.tools) ? toolsConfig.tools : [];

  if (!tools.length) {
    console.log("No tools found in config/tools.json; nothing to seed.");
    return;
  }

  console.log(`Seeding ${tools.length} tools from config/tools.json ...`);

  for (const tool of tools) {
    const {
      name,
      description,
      kind = "business",
      parameters,
      routes,
      ui_command,
      session_update,
    } = tool;

    if (!name || !parameters) {
      console.warn(
        `Skipping tool without name/parameters: ${JSON.stringify(tool)}`
      );
      continue;
    }

    const definitionJson = {
      parameters,
    };

    if (routes) {
      definitionJson.routes = routes;
    }
    if (ui_command) {
      definitionJson.ui_command = ui_command;
    }
    if (session_update) {
      definitionJson.session_update = session_update;
    }

    await prisma.tool.upsert({
      where: { name },
      update: {
        description: description || null,
        kind,
        type: "function",
        definitionJson,
        status: "active",
      },
      create: {
        name,
        description: description || null,
        kind,
        type: "function",
        definitionJson,
        status: "active",
      },
    });

    console.log(`  • Upserted tool: ${name}`);
  }

  console.log("✅ Tool seeding completed.");
}

main()
  .catch((err) => {
    console.error("Failed to seed tools:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

