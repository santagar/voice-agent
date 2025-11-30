"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
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
import { Modal } from "@/components/front/ui/Modal";
import { SelectMenu } from "@/components/front/ui/SelectMenu";

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
  const [activeSection, setActiveSection] = useState<"general" | string>(
    "general"
  );

  // Whenever the dialog is opened, reset to the General section and
  // collapse any open dropdowns so the user always starts from a
  // predictable state.
  useEffect(() => {
    if (open) {
      setActiveSection("general");

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
    <Modal open={open} onClose={onClose}>
      <div
        className={`flex w-full overflow-hidden rounded-3xl border text-sm shadow-xl ${
          isDark
            ? "border-white/10 bg-neutral-900 text-gray-100"
            : "border-zinc-200 bg-white text-gray-900"
        }`}
      >
        {/* Sidebar */}
        <div
          className={`flex w-48 shrink-0 flex-col ${
            isDark ? "bg-neutral-900/80" : "bg-zinc-50"
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
                        : "bg-zinc-200 text-gray-900"
                      : isDark
                      ? "text-gray-300 hover:bg-white/5"
                      : "text-gray-700 hover:bg-zinc-200"
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
        <div
          className={`flex flex-1 flex-col px-6 py-6 ${
            isDark ? "bg-neutral-800" : "bg-white"
          }`}
        >
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
                  <SelectMenu
                    value={appearanceMode}
                    isDark={isDark}
                    options={[
                      {
                        value: "system",
                        label: t("settings.general.appearance.system"),
                      },
                      {
                        value: "light",
                        label: t("settings.general.appearance.light"),
                      },
                      {
                        value: "dark",
                        label: t("settings.general.appearance.dark"),
                      },
                    ]}
                    onChange={(mode) => {
                      const value =
                        mode === "system" || mode === "light" || mode === "dark"
                          ? mode
                          : "system";
                      setAppearanceMode(value);
                      try {
                        document.cookie = `va-theme-mode=${value}; path=/; max-age=31536000`;
                      } catch {
                        // ignore cookie errors
                      }
                      if (value === "system") {
                        const prefersDark =
                          typeof window !== "undefined" &&
                          window.matchMedia &&
                          window.matchMedia(
                            "(prefers-color-scheme: dark)"
                          ).matches;
                        setTheme(prefersDark ? "dark" : "light");
                      } else {
                        setTheme(value);
                      }
                    }}
                  />
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
                  <SelectMenu
                    value={locale}
                    isDark={isDark}
                    options={[
                      {
                        value: "es",
                        label: t("settings.general.language.es"),
                      },
                      {
                        value: "en",
                        label: t("settings.general.language.en"),
                      },
                    ]}
                    onChange={(code) => {
                      const value = code === "es" || code === "en" ? code : "en";
                      setLocale(value);
                    }}
                  />
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
    </Modal>
  );
}
