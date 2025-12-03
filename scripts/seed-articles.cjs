#!/usr/bin/env node

// Seeds help articles into the database using Prisma.
// Requires schema with HelpArticle model (slug+locale unique).
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const seeds = [
  {
    slug: "how-to-write-instructions",
    locale: "en",
    title: "How to write instructions",
    summary:
      "Add concise instructions grouped by type. One line per instruction; keep the order identity → communication → answers → tools → safety.",
    mdUrl: "/help/en/how-to-write-instructions.md",
    category: "guides",
  },
  {
    slug: "how-to-write-instructions",
    locale: "es",
    title: "Cómo escribir instrucciones",
    summary:
      "Añade instrucciones concisas por bloque. Una línea por instrucción; respeta el orden identidad → estilo → respuestas → tools → seguridad.",
    mdUrl: "/help/es/how-to-write-instructions.md",
    category: "guides",
  },
];

async function main() {
  for (const article of seeds) {
    await prisma.article.upsert({
      where: { slug_locale: { slug: article.slug, locale: article.locale } },
      update: {
        title: article.title,
        summary: article.summary,
        mdUrl: article.mdUrl,
        category: article.category,
      },
      create: article,
    });
    console.log(`Upserted help article: ${article.slug} [${article.locale}]`);
  }
}

main()
  .catch((err) => {
    console.error("Failed to seed help articles:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
