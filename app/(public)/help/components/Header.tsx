"use client";

import React from "react";
import Link from "next/link";
import { Aperture } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLocale } from "@/components/locale/LocaleContext";
import { useTheme } from "@/components/theme/ThemeContext";

type HelpHeaderProps = {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
};

export function Header({
  title = "Help",
  subtitle,
  backHref,
  backLabel = "Back to home",
}: HelpHeaderProps) {
  const { locale, setLocale } = useLocale();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const headerSurface = isDark ? "bg-neutral-900/80" : "bg-white/80";
  const mutedText = isDark ? "text-zinc-400" : "text-slate-600";
  const pillButton = isDark
    ? "text-zinc-100 hover:bg-white/10"
    : "text-slate-700 hover:bg-zinc-100";

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur ${headerSurface}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Aperture
            aria-hidden
            className={`h-6 w-6 ${isDark ? "text-white" : "text-slate-900"}`}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{title}</span>
            {subtitle ? (
              <span className={`text-[11px] ${mutedText}`}>{subtitle}</span>
            ) : null}
          </div>
        </div>
        <div className={`flex items-center gap-3 text-xs font-medium ${mutedText}`}>
          {backHref ? (
            <Link
              href={backHref}
              className={`rounded-full px-3 py-1 transition ${pillButton}`}
            >
              {backLabel}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${pillButton}`}
          >
            {locale.toUpperCase()}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
