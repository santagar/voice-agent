import { cookies } from "next/headers";

export type ThemePreference = "light" | "dark";
export type LocalePreference = "en" | "es";

export interface InitialUserPreferences {
  theme: ThemePreference;
  locale: LocalePreference;
  sidebarCollapsed: boolean;
}

/**
 * Reads UI preference cookies on the server and normalizes them into
 * safe defaults so that SSR and client are always aligned.
 *
 * This helper must only be imported from server components or Route
 * Handlers, because it uses `next/headers.cookies()`.
 */
export async function getInitialUserPreferences(): Promise<InitialUserPreferences> {
  const cookieStore = await cookies();

  const themeCookie = cookieStore.get("va-theme")?.value;
  const localeCookie = cookieStore.get("va-locale")?.value;
  const sidebarCookie = cookieStore.get("va-sidebar-collapsed")?.value;

  const theme: ThemePreference = themeCookie === "dark" ? "dark" : "light";
  const locale: LocalePreference = localeCookie === "es" ? "es" : "en";
  const sidebarCollapsed = sidebarCookie === "true";

  return { theme, locale, sidebarCollapsed };
}

