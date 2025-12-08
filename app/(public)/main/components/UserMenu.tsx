import React from "react";
import {
  ArrowUpRight,
  HelpCircle,
  LogOut,
  PanelLeft,
  Settings,
  UserCircle2,
  UserPlus,
  Wand2,
} from "lucide-react";

type UserMenuProps = {
  show: boolean;
  isDark: boolean;
  t: (key: string) => string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  isAdminUser: boolean;
  onClose: () => void;
  onOpenPlatform: () => void;
  onSignOut: () => Promise<void> | void;
};

export function UserMenu({
  show,
  isDark,
  t,
  userName,
  userEmail,
  userImage,
  isAdminUser,
  onClose,
  onOpenPlatform,
  onSignOut,
}: UserMenuProps) {
  if (!show) return null;

  const handleOpenHelp = () => {
    onClose();
    window.open("/help", "_blank", "noreferrer");
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className={`fixed bottom-20 left-4 z-50 w-72 rounded-3xl border shadow-lg backdrop-blur-sm ${
          isDark ? "border-white/10 bg-neutral-900/95" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 overflow-hidden">
                {userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userImage}
                    alt={userName || userEmail || "User avatar"}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserCircle2 className="h-5 w-5" />
                )}
              </div>
              <div className="flex flex-col">
                <span
                  className={`truncate text-sm font-medium ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  {userName || userEmail || t("chat.profile.email")}
                </span>
                {userName && userEmail && (
                  <span
                    className={`truncate text-xs ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {userEmail}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                isDark
                  ? "text-gray-300 hover:bg-white/10"
                  : "text-gray-500 hover:bg-zinc-100"
              }`}
            >
              +
            </button>
          </div>
          {isAdminUser && (
            <button
              type="button"
              onClick={() => {
                onOpenPlatform();
                onClose();
              }}
              className={`mt-3 flex w-full items-center justify-between rounded-2xl px-3 py-2 ${
                isDark
                  ? "bg-sky-500/20 hover:bg-sky-500/30 cursor-pointer"
                  : "bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white">
                  A
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-gray-50">
                  {t("chat.userMenu.adminAccount")}
                </span>
              </div>
            </button>
          )}
        </div>
        <div
          className={`my-1 border-t ${isDark ? "border-white/10" : "border-zinc-200"}`}
        />
        <div className="py-1 px-2 text-xs">
          <button
            type="button"
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
              isDark ? "text-gray-100 hover:bg-white/10" : "text-gray-800 hover:bg-zinc-100"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>{t("chat.userMenu.addTeammates")}</span>
          </button>
          <button
            type="button"
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
              isDark ? "text-gray-100 hover:bg-white/10" : "text-gray-800 hover:bg-zinc-100"
            }`}
          >
            <PanelLeft className="h-4 w-4" />
            <span>{t("chat.userMenu.workspaceSettings")}</span>
          </button>
          <button
            type="button"
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
              isDark ? "text-gray-100 hover:bg-white/10" : "text-gray-800 hover:bg-zinc-100"
            }`}
          >
            <Wand2 className="h-4 w-4" />
            <span>{t("chat.userMenu.personalization")}</span>
          </button>
          <button
            type="button"
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
              isDark ? "text-gray-100 hover:bg-white/10" : "text-gray-800 hover:bg-zinc-100"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>{t("chat.userMenu.settings")}</span>
          </button>
        </div>
        <div
          className={`my-1 border-t ${isDark ? "border-white/10" : "border-zinc-200"}`}
        />
        <div className="pb-3 px-2 text-xs">
          <button
            type="button"
            className={`group mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-left ${
              isDark ? "text-gray-100 hover:bg-white/10" : "text-gray-800 hover:bg-zinc-100"
            }`}
            onClick={handleOpenHelp}
            aria-label={t("chat.userMenu.help")}
            title={t("chat.userMenu.help")}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenHelp();
              }
            }}
          >
            <div className="flex flex-1 items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              <span>{t("chat.userMenu.help")}</span>
            </div>
            <ArrowUpRight
              className={`h-4 w-4 transition-opacity ${
                isDark ? "text-gray-200" : "text-gray-700"
              } opacity-0 group-hover:opacity-100`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={async () => {
              await onSignOut();
              onClose();
            }}
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium cursor-pointer ${
              isDark ? "text-gray-100 hover:bg-white/10" : "text-gray-800 hover:bg-zinc-100"
            }`}
          >
            <LogOut className="h-4 w-4" />
            <span>{t("chat.userMenu.logout")}</span>
          </button>
        </div>
      </div>
    </>
  );
}
