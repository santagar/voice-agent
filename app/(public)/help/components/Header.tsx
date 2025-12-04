"use client";

import React from "react";
import Link from "next/link";
import { Aperture, Monitor, Moon, Sun } from "lucide-react";
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
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [langOpen, setLangOpen] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);
  const langRef = React.useRef<HTMLDivElement | null>(null);
  const themeRef = React.useRef<HTMLDivElement | null>(null);
  const [themeMode, setThemeMode] = React.useState<"light" | "dark" | "system">(
    () => (theme === "light" || theme === "dark" ? theme : "system")
  );

  const languages = [
    { code: "en", label: "English", region: "United States" },
    { code: "es", label: "Español", region: "España" },
  ];

  const activeLang = languages.find((l) => l.code === locale) ?? languages[0];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Node) {
        if (langOpen && langRef.current && !langRef.current.contains(event.target)) {
          setLangOpen(false);
        }
        if (themeOpen && themeRef.current && !themeRef.current.contains(event.target)) {
          setThemeOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [langOpen, themeOpen]);

  React.useEffect(() => {
    try {
      const cookie = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("va-theme-mode="));
      const value = cookie ? cookie.split("=")[1] : null;
      if (value === "light" || value === "dark" || value === "system") {
        setThemeMode((prev) => (prev === value ? prev : (value as typeof prev)));
      }
    } catch {
      // ignore cookie parse errors
    }
  }, []);

  const persistThemeMode = (mode: "light" | "dark" | "system") => {
    setThemeMode(mode);
    try {
      document.cookie = `va-theme-mode=${mode}; path=/; max-age=31536000`;
    } catch {
      // ignore cookie write errors
    }
    if (mode === "system") {
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } else {
      setTheme(mode);
    }
  };

  const headerSurface =
    "bg-[color:var(--background)]/80";
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
          <div className="relative" ref={langRef}>
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
                      className={`flex h-10 w-full items-center justify-between px-3 text-sm transition ${
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
          <div className="relative" ref={themeRef}>
            <button
              type="button"
              onClick={() => setThemeOpen((prev) => !prev)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                isDark
                  ? "border-white/20 text-white hover:bg-white/10"
                  : "border-gray-300 text-gray-900 hover:bg-zinc-100"
              }`}
              aria-haspopup="listbox"
              aria-expanded={themeOpen}
            >
              {themeMode === "system" ? (
                <Monitor className="h-4 w-4" />
              ) : themeMode === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
            {themeOpen ? (
              <div
                className={`absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border shadow-lg ${
                  isDark
                    ? "border-white/10 bg-neutral-900 text-zinc-100"
                    : "border-gray-200 bg-white text-gray-900"
                }`}
                role="listbox"
              >
                {[
                  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
                  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
                  { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
                ].map((opt) => {
                  const isActive = themeMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        persistThemeMode(opt.value as "light" | "dark" | "system");
                        setThemeOpen(false);
                      }}
                      className={`flex h-10 w-full items-center gap-2 px-3 text-sm transition ${
                        isDark
                          ? isActive
                            ? "bg-white/10"
                            : "hover:bg-white/5"
                          : isActive
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
