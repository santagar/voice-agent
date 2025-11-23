 "use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { labTheme } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function DocsPage() {
  const [content, setContent] = useState<string>("");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/docs.md");
        if (!res.ok) return;
        const text = await res.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch {
        // ignore; leave content empty
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      className={`min-h-screen overflow-auto ${
        isDark ? "bg-neutral-900 text-slate-50" : "bg-zinc-50 text-slate-900"
      }`}
      style={isDark ? { backgroundImage: labTheme.gradients.canvas } : undefined}
    >
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-8 lg:px-12">
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to home</span>
            </Link>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Voice Agent Docs
            </span>
          </div>
          <ThemeToggle />
        </header>

        <section className="flex-1 rounded-2xl border border-white/10 bg-neutral-900/80 px-4 py-4 shadow-xl backdrop-blur-xl sm:px-6 sm:py-5">
          {content ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              Loading documentation…
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
