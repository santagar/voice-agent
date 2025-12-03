"use client";

import React from "react";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/locale/LocaleContext";
import { useTheme } from "@/components/theme/ThemeContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Header } from "./components/Header";

type Article = {
  locale: string;
  slug: string;
  title: string;
  summary?: string;
};

type ClientProps = {
  articles: Article[];
};

export function Client({ articles }: ClientProps) {
  const { locale, setLocale } = useLocale();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles
      .filter((a) => a.locale === locale)
      .filter((a) => {
        if (!q) return true;
        return (
          a.title.toLowerCase().includes(q) ||
          (a.summary ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [articles, locale, query]);

  const pageBackground = isDark
    ? "bg-neutral-900 text-zinc-100"
    : "bg-white text-slate-900";
  const mutedText = isDark ? "text-zinc-400" : "text-slate-600";
  const cardBg = isDark ? "bg-neutral-900" : "bg-white";
  const cardBorder = isDark ? "border-white/10" : "border-zinc-200";
  const pillButton = isDark
    ? "text-zinc-100 hover:bg-white/10"
    : "text-slate-700 hover:bg-zinc-100";

  return (
    <main className={`min-h-screen ${pageBackground}`}>
      <Header
        title="Help"
        subtitle=""
        backHref="/"
        backLabel="Back to home"
      />

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-black/10 dark:border-white/10 dark:focus-within:ring-white/10">
            <Search className={`h-4 w-4 ${mutedText}`} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help articles..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
            />
          </div>
          <p className={`mt-3 text-sm ${mutedText}`}>
            Showing {filtered.length} article{filtered.length === 1 ? "" : "s"} in {locale.toUpperCase()}.
          </p>
        </div>

        <div className="space-y-3">
          {filtered.map((article) => (
            <Link
              key={`${article.locale}-${article.slug}`}
              href={`/help/${article.slug}`}
              className={`block rounded-2xl border ${cardBorder} ${cardBg} px-5 py-4 transition hover:-translate-y-[1px] hover:shadow-sm`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                    {article.title}
                  </p>
                  {article.summary ? (
                    <p className={`mt-1 truncate text-sm ${mutedText}`}>
                      {article.summary}
                    </p>
                  ) : null}
                </div>
                <ArrowRight className={`h-4 w-4 ${mutedText}`} />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div
              className={`rounded-2xl border ${cardBorder} ${cardBg} px-5 py-6 text-sm ${mutedText}`}
            >
              No articles found for this language.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
