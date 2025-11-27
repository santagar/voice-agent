"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";

type UserMenuProps = {
  email: string;
};

export function UserMenu({ email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const isLight = theme === "light";
  const [mode, setMode] = useState<"system" | "light" | "dark">("system");

  // Sync initial appearance mode with the preference cookie used in the
  // front Settings dialog so behaviour is consistent across front/back.
  useEffect(() => {
    try {
      const cookie = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("va-theme-mode="));
      if (cookie) {
        const value = cookie.split("=")[1];
        if (value === "light" || value === "dark" || value === "system") {
          setMode(value);
        }
      }
    } catch {
      // ignore cookie parse errors
    }
  }, []);

  const persistMode = (next: "system" | "light" | "dark") => {
    setMode(next);
    try {
      document.cookie = `va-theme-mode=${next}; path=/; max-age=31536000`;
    } catch {
      // ignore cookie write errors
    }
  };

  return (
    <div className="relative flex items-center gap-3 text-sm">
      <button
        type="button"
        className={`rounded-full px-3 py-1 transition-colors ${
          isDark
            ? "text-gray-200 hover:bg-neutral-800"
            : "text-gray-500 hover:bg-zinc-100"
        }`}
      >
        Docs
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1 transition-colors ${
          isDark
            ? "text-gray-200 hover:bg-neutral-800"
            : "text-gray-500 hover:bg-zinc-100"
        }`}
      >
        API reference
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
          isDark
            ? "bg-white text-neutral-900 hover:bg-zinc-100"
            : "bg-black text-white hover:bg-neutral-900"
        }`}
      >
        Start building
      </button>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          isDark
            ? "bg-gray-200 text-neutral-900 hover:bg-white"
            : "bg-zinc-800 text-white hover:bg-zinc-900"
        }`}
        aria-label="Open account menu"
      >
        S
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={`absolute right-0 top-10 z-50 w-64 rounded-3xl border shadow-xl ${
              isDark
                ? "border-neutral-700 bg-neutral-900 text-gray-50"
                : "border-zinc-200 bg-white text-gray-900"
            }`}
          >
            <div className="px-4 pt-3 pb-2">
              <p className="text-sm font-semibold">Administrator</p>
              <p
                className={`text-xs ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {email}
              </p>
              <div
                className={`mt-3 inline-flex items-center gap-2 rounded-2xl px-2 py-1.5 ${
                  isDark ? "bg-neutral-800" : "bg-zinc-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    persistMode("light");
                    setTheme("light");
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                    mode === "light"
                      ? "bg-white text-gray-900 shadow-sm"
                      : isDark
                      ? "text-gray-400 hover:bg-neutral-700"
                      : "text-gray-500 hover:bg-zinc-200"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    persistMode("dark");
                    setTheme("dark");
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                    mode === "dark"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-gray-500 hover:bg-zinc-200"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prefersDark =
                      typeof window !== "undefined" &&
                      window.matchMedia &&
                      window.matchMedia("(prefers-color-scheme: dark)")
                        .matches;
                    setTheme(prefersDark ? "dark" : "light");
                    persistMode("system");
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                    mode === "system"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : isDark
                      ? "text-gray-400 hover:bg-neutral-700"
                      : "text-gray-500 hover:bg-zinc-200"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="my-1 border-t border-zinc-200 dark:border-neutral-800" />
            <div className="py-2 text-sm">
              <button
                type="button"
                className={`flex w-full items-center px-4 py-1.5 text-left transition-colors ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-zinc-50"
                }`}
              >
                Manage cookies
              </button>
              <button
                type="button"
                className={`flex w-full items-center px-4 py-1.5 text-left transition-colors ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-zinc-50"
                }`}
              >
                Terms &amp; policies
              </button>
              <button
                type="button"
                className={`flex w-full items-center px-4 py-1.5 text-left transition-colors ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-zinc-50"
                }`}
              >
                Help
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut({ callbackUrl: "/" });
                }}
                className={`flex w-full items-center px-4 py-1.5 text-left transition-colors ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-zinc-50"
                }`}
              >
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
