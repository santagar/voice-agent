import { notFound } from "next/navigation";
import type { Article } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getInitialUserPreferences } from "@/lib/server/userPreferences";
import { Client } from "./Client";

const FALLBACK_LOCALE = "en";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale } = await getInitialUserPreferences();

  const articles: Article[] = await prisma.article.findMany({
    where: { slug },
    orderBy: { locale: "asc" },
  });

  if (!articles.length) {
    return notFound();
  }

  const article =
    articles.find((article: Article) => article.locale === locale) ||
    articles.find((article: Article) => article.locale === FALLBACK_LOCALE) ||
    articles[0];

  let markdown = "";
  try {
    const base =
      typeof process.env.NEXT_PUBLIC_SITE_URL === "string" &&
      process.env.NEXT_PUBLIC_SITE_URL.trim().length
        ? process.env.NEXT_PUBLIC_SITE_URL
        : "http://localhost:3000";
    const url = article.mdUrl.startsWith("http")
      ? article.mdUrl
      : new URL(article.mdUrl, base).toString();

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch markdown: ${res.status}`);
    markdown = await res.text();
  } catch (err) {
    console.error("Failed to load article markdown", err);
    return notFound();
  }

  return (
    <Client
      markdown={markdown}
      updatedAt={article.updatedAt?.toISOString?.() ?? undefined}
      titleOverride={article.title}
    />
  );
}
