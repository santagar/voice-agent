"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserMenu } from "@/components/back/UserMenu";
import { useTheme } from "@/components/theme/ThemeContext";

type PlatformShellProps = {
  children: ReactNode;
  userEmail: string;
  userName: string | null;
  userImage: string | null;
};

type NavItem = {
  label: string;
  href?: string;
};

export function PlatformShell({
  children,
  userEmail,
  userName,
  userImage,
}: PlatformShellProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();
  const pathname = usePathname();

  const organizationItems: NavItem[] = [
    { label: "General" },
    { label: "API keys" },
    { label: "Admin keys" },
    { label: "People", href: "/platform/people" },
    { label: "Projects" },
    { label: "Assistants", href: "/platform/assistants" },
  ];

  const isActive = (item: NavItem) => {
    if (!item.href) return false;
    if (item.href === "/platform/people") {
      return pathname === "/platform/people";
    }
    if (item.href === "/platform/assistants") {
      return pathname === "/platform/assistants";
    }
    return pathname.startsWith(item.href);
  };

  const handleNavigate = (item: NavItem) => {
    if (!item.href || pathname === item.href) return;
    router.push(item.href);
  };

  return (
    <main
      className={`min-h-screen ${
        isDark ? "bg-neutral-900 text-gray-50" : "bg-zinc-50 text-gray-900"
      }`}
    >
      <div
        className={`flex h-14 items-center justify-between px-4 ${
          isDark ? "bg-neutral-900" : "bg-zinc-50"
        }`}
      >
        <div className="flex items-center gap-2 text-xl font-semibold">
          <span>Voice Agent Platform</span>
        </div>
        <UserMenu email={userEmail} name={userName || undefined} image={userImage || undefined} />
      </div>

      <div className="flex min-h-[calc(100vh-56px)]">
        <aside
          className={`hidden w-56 px-3 py-4 text-sm sm:flex sm:flex-col  ${
            isDark
              ? "bg-neutral-900 text-gray-200"
              : "bg-zinc-50/80 text-gray-700"
          }`}
        >
          <div className="mb-4">
            <p
              className={`px-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`}
            >
              Settings
            </p>
            <nav className="mt-2 space-y-0.5">
              {["Your profile", "Organization"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left ${
                    isDark
                      ? "hover:bg-neutral-800 text-gray-200"
                      : "hover:bg-zinc-100 text-gray-700"
                  }`}
                >
                  <span>{item}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="mb-4">
            <p
              className={`px-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`}
            >
              Organization
            </p>
            <nav className="mt-2 space-y-0.5">
              {organizationItems.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleNavigate(item)}
                    className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left ${
                      active && isDark
                        ? "bg-neutral-800 text-gray-50"
                        : active && !isDark
                        ? "bg-zinc-900 text-zinc-50"
                        : isDark
                        ? "hover:bg-neutral-800 text-gray-200"
                        : "hover:bg-zinc-100 text-gray-700"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div
            className={`mt-auto border-t pt-3 ${
              isDark ? "border-neutral-800" : "border-zinc-200"
            }`}
          >
            <button
              type="button"
              className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm ${
                isDark
                  ? "text-gray-300 hover:bg-neutral-800"
                  : "text-gray-600 hover:bg-zinc-100"
              }`}
            >
              Cookbook
            </button>
            <button
              type="button"
              className={`mt-1 flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm ${
                isDark
                  ? "text-gray-300 hover:bg-neutral-800"
                  : "text-gray-600 hover:bg-zinc-100"
              }`}
            >
              Forum
            </button>
          </div>
        </aside>

        <section
          className={`flex-1 border-t border-l px-4 pb-6 pt-4 sm:px-5 lg:px-6 rounded-tl-2xl ${
            isDark
              ? "border-neutral-800 bg-neutral-950"
              : "border-zinc-200 bg-white"
          }`}
        >
          {children}
        </section>
      </div>
    </main>
  );
}

