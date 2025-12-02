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
      name,
      description: description || "",
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

    // For templates we always keep a single global row (assistantId = null)
    // per tool name. We can't use `upsert` with a composite unique where
    // one side is nullable, so we emulate it with findFirst + update/create.
    const existing = await prisma.tool.findFirst({
      where: {
        name,
        assistantId: null,
      },
    });

    if (existing) {
      await prisma.tool.update({
        where: { id: existing.id },
        data: {
          kind,
          type: "function",
          definitionJson,
          status: "active",
        },
      });
    } else {
      await prisma.tool.create({
        data: {
          name,
          kind,
          type: "function",
          definitionJson,
          status: "active",
          assistantId: null,
        },
      });
    }

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
