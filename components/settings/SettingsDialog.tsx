"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Palette,
  Plug,
  Shield,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";
import { useLocale } from "@/components/locale/LocaleContext";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

const sections = [
  { key: "general", icon: Palette },
  { key: "notifications", icon: Bell },
  { key: "personalization", icon: Sparkles },
  { key: "apps", icon: Plug },
  { key: "schedules", icon: CalendarClock },
  { key: "data", icon: ShieldCheck },
  { key: "security", icon: Shield },
  { key: "account", icon: UserIcon },
] as const;

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const isDark = theme === "dark";
  const [appearanceMode, setAppearanceMode] = useState<
    "system" | "light" | "dark"
  >("system");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"general" | string>(
    "general"
  );

  // Whenever the dialog is opened, reset to the General section and
  // collapse any open dropdowns so the user always starts from a
  // predictable state.
  useEffect(() => {
    if (open) {
      setActiveSection("general");
      setAppearanceOpen(false);
      setLanguageOpen(false);

      // Sync appearance mode with the user preference stored in cookie (UI only).
      try {
        const cookie = document.cookie
          .split("; ")
          .find((entry) => entry.startsWith("va-theme-mode="));
        if (cookie) {
          const value = cookie.split("=")[1];
          if (value === "light" || value === "dark" || value === "system") {
            setAppearanceMode(value);
          }
        }
      } catch {
        // ignore cookie parse errors
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
      aria-hidden
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full max-w-2xl overflow-hidden rounded-3xl border text-sm shadow-xl ${
          isDark
            ? "border-white/10 bg-neutral-900 text-gray-100"
            : "border-zinc-200 bg-white text-gray-900"
        }`}
      >
        {/* Sidebar */}
        <div
          className={`flex w-48 shrink-0 flex-col border-r ${
            isDark
              ? "border-white/5 bg-neutral-900/80"
              : "border-zinc-200/60 bg-zinc-50"
          }`}
        >
          <div className="flex items-center px-3 py-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm cursor-pointer ${
                isDark
                  ? "border-transparent text-gray-200 hover:border-transparent hover:bg-white/10"
                  : "border-transparent text-gray-700 hover:border-transparent hover:bg-zinc-200"
              }`}
              aria-label={t("settings.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
            <nav className="space-y-1 px-2 pb-3 pt-1">
            {sections.map(({ key, icon: Icon }) => {
              const active = key === activeSection;
              const labelKey = `settings.nav.${key}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    active
                      ? isDark
                        ? "bg-white/10 text-gray-50"
                        : "bg-zinc-100 text-gray-900"
                      : isDark
                      ? "text-gray-300 hover:bg-white/5"
                      : "text-gray-700 hover:bg-zinc-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col px-6 py-6">
          {activeSection === "general" ? (
            <div className="flex flex-col gap-6">
              <div
                className={`pb-3 border-b ${
                  isDark ? "border-white/10" : "border-gray-200"
                }`}
              >
                <h2 className="text-lg font-semibold">
                  {t("settings.general.title")}
                </h2>
              </div>

              {/* Appearance */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200/30 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t("settings.general.appearance.label")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t("settings.general.appearance.helper")}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAppearanceOpen((prev) => !prev)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
                        isDark
                          ? "bg-transparent text-gray-100 hover:bg-white/10"
                          : "bg-transparent text-gray-800 hover:bg-zinc-100"
                      }`}
                    >
                      <span>
                        {appearanceMode === "system"
                          ? t("settings.general.appearance.system")
                          : appearanceMode === "light"
                          ? t("settings.general.appearance.light")
                          : t("settings.general.appearance.dark")}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-80" />
                    </button>
                    {appearanceOpen && (
                      <div
                        className={`absolute right-0 z-40 mt-1 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
                          isDark
                            ? "border-white/10 bg-neutral-800/95"
                            : "border-zinc-200 bg-white"
                        }`}
                      >
                        {(["system", "light", "dark"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setAppearanceMode(mode);
                              try {
                                document.cookie = `va-theme-mode=${mode}; path=/; max-age=31536000`;
                              } catch {
                                // ignore cookie errors
                              }
                              if (mode === "system") {
                                const prefersDark =
                                  typeof window !== "undefined" &&
                                  window.matchMedia &&
                                  window.matchMedia(
                                    "(prefers-color-scheme: dark)"
                                  ).matches;
                                setTheme(prefersDark ? "dark" : "light");
                              } else {
                                setTheme(mode);
                              }
                              setAppearanceOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-[14px] cursor-pointer ${
                              isDark
                                ? "text-gray-100 hover:bg-white/10"
                                : "text-gray-800 hover:bg-zinc-50"
                            }`}
                          >
                            <span className="flex-1 text-left">
                              {mode === "system"
                                ? t("settings.general.appearance.system")
                                : mode === "light"
                                ? t("settings.general.appearance.light")
                                : t("settings.general.appearance.dark")}
                            </span>
                            {appearanceMode === mode && (
                              <Check className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Language */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200/30 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t("settings.general.language.ui")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t("settings.general.language.helper")}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLanguageOpen((prev) => !prev)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
                        isDark
                          ? "bg-transparent text-gray-100 hover:bg-white/10"
                          : "bg-transparent text-gray-800 hover:bg-zinc-100"
                      }`}
                    >
                      <span>
                        {locale === "es"
                          ? t("settings.general.language.es")
                          : t("settings.general.language.en")}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-80" />
                    </button>
                    {languageOpen && (
                      <div
                        className={`absolute right-0 z-40 mt-1 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
                          isDark
                            ? "border-white/10 bg-neutral-800/95"
                            : "border-zinc-200 bg-white"
                        }`}
                      >
                        {(["es", "en"] as const).map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setLocale(code);
                              setLanguageOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-[14px] cursor-pointer ${
                              isDark
                                ? "text-gray-100 hover:bg-white/10"
                                : "text-gray-800 hover:bg-zinc-50"
                            }`}
                          >
                            <span className="flex-1 text-left">
                              {code === "es"
                                ? t("settings.general.language.es")
                                : t("settings.general.language.en")}
                            </span>
                            {locale === code && (
                              <Check className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-gray-400">
              {t("settings.section.placeholder")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
