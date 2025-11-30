"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: React.ReactNode;
  initialTheme: Theme;
};

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Apply theme to <html> and persist in a stable cookie
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    // Persist theme in a cookie so the server can render
    // the correct theme on the next request.
    try {
      document.cookie = `va-theme=${theme}; path=/; max-age=31536000`;
    } catch {
      // ignore cookie errors
    }
  }, [theme]);

  // If the user selected "system" appearance, follow the OS
  // color-scheme and react to changes over time.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyFromSystemIfNeeded = () => {
      try {
        const cookie = document.cookie
          .split("; ")
          .find((entry) => entry.startsWith("va-theme-mode="));
        const mode = cookie ? cookie.split("=")[1] : null;
        if (mode === "system") {
          setThemeState(media.matches ? "dark" : "light");
        }
      } catch {
        // ignore cookie errors
      }
    };

    // Initial sync on mount
    applyFromSystemIfNeeded();

    const listener = () => applyFromSystemIfNeeded();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
    } else if (typeof media.addListener === "function") {
      media.addListener(listener);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", listener);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(listener);
      }
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
