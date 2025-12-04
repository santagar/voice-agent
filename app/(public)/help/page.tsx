import { prisma } from "@/lib/prisma";
import { Client } from "./Client";
import { Suspense } from "react";
import { Loader } from "./components/Loader";

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

  const sanitized = articles.map((article) => ({
    ...article,
    summary: article.summary ?? undefined,
  }));

  return (
    <Suspense fallback={<Loader />}>
      <Client articles={sanitized} />
    </Suspense>
  );
}
