"use client";

import React from "react";
import { ArrowRight, ChevronRight, Search, X } from "lucide-react";
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
  const { locale, setLocale, t } = useLocale();
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

  const mutedText = isDark ? "text-zinc-300" : "text-slate-600";

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <Header
        title="Help"
        subtitle=""
        backHref="/"
        backLabel="Back to home"
      />

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div
            className={`flex items-center gap-3 border-b pb-3 transition ${
              isDark
                ? "border-white/20 focus-within:border-white"
                : "border-slate-300 focus-within:border-slate-800"
            }`}
          >
            <Search className={`h-5 w-5 ${isDark ? "text-zinc-300" : "text-slate-600"}`} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("help.search.placeholder")}
              className={`w-full bg-transparent text-lg font-medium outline-none appearance-none ${
                isDark
                  ? "text-white placeholder:text-zinc-500"
                  : "text-slate-900 placeholder:text-slate-700"
              } [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden`}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("help.search.clear")}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                  isDark ? "text-zinc-300 hover:bg-white/10" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((article) => (
            <Link
              key={`${article.locale}-${article.slug}`}
              href={`/help/${article.slug}`}
              className={`block rounded-2xl border px-5 py-4 transition ${
                isDark
                  ? "border-white/10 bg-neutral-800 hover:bg-neutral-700"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`truncate text-base font-semibold ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {article.title}
                  </p>
                  {article.summary ? (
                    <p className={`mt-1 truncate text-sm ${mutedText}`}>
                      {article.summary}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className={`h-5 w-5 ${mutedText}`} />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div
              className={`rounded-2xl border px-5 py-6 text-sm ${mutedText} ${
                isDark
                  ? "border-white/10 bg-neutral-800"
                  : "border-slate-200 bg-white"
              }`}
            >
              {t("help.empty")}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
