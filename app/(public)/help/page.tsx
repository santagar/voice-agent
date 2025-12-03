import { prisma } from "@/lib/prisma";
import { Client } from "./Client";

export default async function HelpIndexPage() {
  const articles = await prisma.article.findMany({
    orderBy: [{ locale: "asc" }, { title: "asc" }],
    select: {
      locale: true,
      slug: true,
      title: true,
      summary: true,
    },
  });
  return <Client articles={articles} />;
}
