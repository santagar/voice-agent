"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

type Locale = "en" | "es";

type Messages = Record<string, string>;

const dictionaries: Record<Locale, Messages> = {
  en,
  es,
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

type LocaleProviderProps = {
  children: React.ReactNode;
  initialLocale: Locale;
};

export function LocaleProvider({
  children,
  initialLocale,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `va-locale=${next}; path=/; max-age=31536000`;
    } catch {
      // ignore cookie errors
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      const dict = dictionaries[locale] ?? dictionaries.es;
      return dict[key] ?? key;
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
