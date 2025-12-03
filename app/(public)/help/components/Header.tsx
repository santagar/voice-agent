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
  const [langOpen, setLangOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  const languages = [
    { code: "en", label: "English", region: "United States" },
    { code: "es", label: "Español", region: "España" },
  ];

  const activeLang = languages.find((l) => l.code === locale) ?? languages[0];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const headerSurface = isDark ? "bg-neutral-900/80" : "bg-white/80";
  const mutedText = isDark ? "text-zinc-400" : "text-gray-600";
  const pillButton = isDark
    ? "text-zinc-100 hover:bg-white/10"
    : "text-gray-700 hover:bg-zinc-100";

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur ${headerSurface}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Aperture
            aria-hidden
            className={`h-6 w-6 ${isDark ? "text-white" : "text-gray-900"}`}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-semibold">{title}</span>
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
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setLangOpen((prev) => !prev)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-small transition ${
                isDark
                  ? "border-white/20 text-white hover:bg-white/10"
                  : "border-gray-300 text-gray-900 hover:bg-zinc-100"
              }`}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <span className="text-sm font-medium">{activeLang.label}</span>
            </button>
            {langOpen ? (
              <div
                className={`absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border shadow-lg ${
                  isDark
                    ? "border-white/10 bg-neutral-900 text-zinc-100"
                    : "border-gray-200 bg-white text-gray-900"
                }`}
                role="listbox"
              >
                {languages.map((lang) => {
                  const isActive = lang.code === activeLang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setLocale(lang.code as "en" | "es");
                        setLangOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${
                        isDark
                          ? isActive
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                          : isActive
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium">{lang.label}</span>
                      <span className={`text-xs ${mutedText}`}>{lang.region}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
