"use client";

import React from "react";
import { Archive, ArrowLeft, Bug, Ellipsis, HelpCircle, Menu, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/front/ui/IconButton";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { AssistantSelector, AssistantSummary } from "./AssistantSelector";

type HeaderProps = {
  isDark: boolean;
  wsConnected: boolean;
  callStatus: "idle" | "calling" | "in_call";
  loggedIn: boolean;
  isAdminUser: boolean;
  assistantHasConfig?: boolean;
  showMenu: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onToggleMobileSidebar: () => void;
  onOpenLogin: () => void;
  assistants: AssistantSummary[];
  activeAssistantId: string | null;
  onChangeAssistant: (id: string) => void;
  viewMode: "chat" | "assistant-editor";
  isChatView: boolean;
  hasActiveConversation: boolean;
  onBackToChat: () => void;
  onArchiveConversation: () => void;
  onRequestDeleteConversation: () => void;
  showDebug: boolean;
  onToggleDebug: () => void;
  assistantSelectorDisabled?: boolean;
  t: (key: string) => string;
};

export function Header({
  isDark,
  wsConnected,
  callStatus,
  loggedIn,
  isAdminUser,
  assistantHasConfig,
  showMenu,
  onToggleMenu,
  onCloseMenu,
  onToggleMobileSidebar,
  onOpenLogin,
  assistants,
  activeAssistantId,
  onChangeAssistant,
  viewMode,
  isChatView,
  hasActiveConversation,
  onBackToChat,
  onArchiveConversation,
  onRequestDeleteConversation,
  showDebug,
  onToggleDebug,
  assistantSelectorDisabled,
  t,
}: HeaderProps) {
  const callActive = callStatus === "calling" || callStatus === "in_call";
  const router = useRouter();

  const visibilityClass = callActive ? "hidden md:flex" : "flex";

  return (
    <header
      className={`sticky top-0 z-20 h-14 flex-wrap items-center justify-between gap-2 border-b px-3 border-none md:flex ${visibilityClass}`}
    >
      <div className="flex items-center gap-1.5">
        <IconButton
          onClick={onToggleMobileSidebar}
          className={`md:hidden rounded-lg ${
            isDark ? "text-white" : "text-slate-900"
          }`}
          aria-label={t("chat.aria.header.toggleMenu")}
        >
          <Menu className="h-5 w-5" />
        </IconButton>

        <div
          className={`flex h-10 items-center gap-0 rounded-lg border px-1 transition ${
            isDark
              ? "border-transparent bg-transparent hover:border-transparent hover:bg-white/10"
              : "border-transparent bg-transparent hover:border-transparent hover:bg-zinc-100"
          }`}
        >
          <span
            className={`status-dot ${
              wsConnected
                ? assistantHasConfig === false
                  ? "dot-warning"
                  : "dot-online"
                : "dot-offline"
            } ml-2 mr-1 h-2.5 w-2.5`}
            aria-hidden
          />
          <div className="-ml-1.5">
            <AssistantSelector
              isDark={isDark}
              loggedIn={loggedIn}
              assistants={assistants}
              activeAssistantId={activeAssistantId}
              onChangeAssistant={onChangeAssistant}
              disabled={assistantSelectorDisabled}
              t={t}
            />
          </div>
        </div>
      </div>

      {loggedIn && showMenu && (isChatView || viewMode === "assistant-editor" || isAdminUser) && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={onCloseMenu}
            aria-hidden
          />
          <div
            className={`absolute right-4 top-14 z-40 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
              isDark
                ? "border-white/10 bg-neutral-800/95"
                : "border-zinc-200 bg-white"
            }`}
          >
            {viewMode === "assistant-editor" && (
              <div className="px-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onBackToChat();
                    onCloseMenu();
                    router.push("/");
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                    isDark
                      ? "text-slate-100 hover:bg-white/10"
                      : "text-slate-800 hover:bg-zinc-50"
                  }`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">
                    {t("chat.menu.backToChat")}
                  </span>
                </button>
              </div>
            )}
            {isChatView && hasActiveConversation && (
              <>
                <div className="px-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onArchiveConversation();
                      onCloseMenu();
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                      isDark
                        ? "text-slate-100 hover:bg-white/10"
                        : "text-slate-800 hover:bg-zinc-50"
                    }`}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">
                      {t("chat.menu.archive")}
                    </span>
                  </button>
                </div>
                <div className="px-1 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      onCloseMenu();
                      onRequestDeleteConversation();
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                      isDark
                        ? "text-red-300 hover:bg-red-500/10"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">
                      {t("chat.menu.delete")}
                    </span>
                  </button>
                </div>
                {isAdminUser && (
                  <div
                    className={`mx-3 my-1 h-px ${
                      isDark ? "bg-white/10" : "bg-zinc-200"
                    }`}
                  />
                )}
              </>
            )}
            <div className="px-1 pb-1">
              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleDebug();
                    onCloseMenu();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                    isDark
                      ? "text-slate-100 hover:bg-white/10"
                      : "text-slate-800 hover:bg-zinc-50"
                  }`}
                >
                  <Bug className="h-3.5 w-3.5 text-sky-300" />
                  <span className="flex-1 text-left">
                    {t("chat.menu.debug")} {showDebug ? "(on)" : "(off)"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        {loggedIn ? (
          <IconButton
            isDark={isDark}
            variant="ghost"
            className={`rounded-lg ${
              !isDark ? "hover:bg-zinc-100" : ""
            }`}
            onClick={onToggleMenu}
          >
            <Tooltip label={t("chat.menu.moreOptions")}>
              <span>
                <Ellipsis className="h-5 w-5" />
              </span>
            </Tooltip>
          </IconButton>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenLogin}
              className={`inline-flex cursor-pointer rounded-full px-4 py-2 text-sm font-medium ${
                isDark
                  ? "bg-white text-neutral-900 hover:bg-gray-100"
                  : "bg-black text-white hover:bg-neutral-900"
              }`}
            >
              {t("chat.login.open")}
            </button>
            <IconButton
              isDark={isDark}
              variant="ghost"
              className={`rounded-lg ${
                !isDark ? "hover:bg-zinc-100" : ""
              }`}
              onClick={() => router.push("/help")}
              aria-label={t("chat.userMenu.help")}
            >
              <Tooltip label={t("chat.userMenu.help")}>
                <span>
                  <HelpCircle className="h-5 w-5" />
                </span>
              </Tooltip>
            </IconButton>
          </>
        )}
      </div>
    </header>
  );
}
