"use client";

import { UserMenu } from "@/components/back/UserMenu";
import { useTheme } from "@/components/theme/ThemeContext";

type PlatformClientProps = {
  userEmail: string;
  userName: string | null;
  userImage: string | null;
};

export default function PlatformPeopleClientPage({
  userEmail,
  userName,
  userImage,
}: PlatformClientProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
        <UserMenu email={userEmail} name={userName} image={userImage} />
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
              {[
                "General",
                "API keys",
                "Admin keys",
                "People",
                "Projects",
              ].map((item) => {
                const active = item === "People";
                return (
                  <button
                    key={item}
                    type="button"
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
                    <span>{item}</span>
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1
                className={`text-lg font-semibold ${
                  isDark ? "text-gray-50" : "text-zinc-900"
                }`}
              >
                People &amp; Permissions
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Manage members and roles for this workspace.
              </p>
            </div>
          </div>

          <div className="border-b border-zinc-200 dark:border-neutral-800">
            <nav className="-mb-px flex gap-4 text-sm">
              {["Members", "Invitations", "Groups", "Roles"].map((tab, idx) => {
                const active = idx === 0;
                return (
                  <button
                    key={tab}
                    type="button"
                    className={`border-b-2 px-1 pb-2 ${
                      active
                        ? isDark
                          ? "border-gray-50 text-gray-50"
                          : "border-gray-900 text-gray-900"
                        : isDark
                        ? "border-transparent text-gray-400 hover:text-gray-200"
                        : "border-transparent text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                placeholder="Search members..."
                className={`h-9 w-full rounded-full border px-3 text-sm focus:outline-none ${
                  isDark
                    ? "border-neutral-700 bg-neutral-900 text-gray-100 placeholder:text-gray-500"
                    : "border-zinc-200 bg-zinc-50 text-gray-800 placeholder:text-gray-400"
                }`}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 ${
                  isDark
                    ? "border-neutral-700 text-gray-100 hover:bg-neutral-800"
                    : "border-zinc-300 text-gray-800 hover:bg-zinc-50"
                }`}
              >
                Export
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 font-semibold ${
                  isDark
                    ? "bg-white text-neutral-900 hover:bg-zinc-100"
                    : "bg-black text-white hover:bg-neutral-900"
                }`}
              >
                Add member
              </button>
            </div>
          </div>

          <div
            className={`mt-4 rounded-2xl border p-3 text-sm shadow-sm ${
              isDark
                ? "border-neutral-800 bg-neutral-900"
                : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                    isDark
                      ? "bg-neutral-800 text-gray-100"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {(userName || userEmail || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p
                    className={`text-base font-medium ${
                      isDark ? "text-gray-50" : "text-zinc-900"
                    }`}
                  >
                    {userName || userEmail}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-[1px] text-[11px] font-semibold ${
                        isDark
                          ? "bg-emerald-900/60 text-emerald-200"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      You
                    </span>
                    <span
                      className={`rounded-full px-2 py-[1px] text-[11px] font-medium ${
                        isDark
                          ? "bg-neutral-800 text-gray-200"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      Owner
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm ${
                    isDark
                      ? "border-neutral-700 text-gray-100 hover:bg-neutral-800"
                      : "border-zinc-300 text-gray-800 hover:bg-zinc-50"
                  }`}
                >
                  Leave
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${
                    isDark
                      ? "border-white text-white hover:bg-white hover:text-neutral-900"
                      : "border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  Roles
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

