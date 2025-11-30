"use client";

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
    <>
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
    </>
  );
}
