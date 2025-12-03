"use client";

import React from "react";
import { Ellipsis, HelpCircle, Menu } from "lucide-react";
import { IconButton } from "@/components/front/ui/IconButton";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { AssistantSelector, AssistantSummary } from "./AssistantSelector";

type HeaderProps = {
  isDark: boolean;
  wsConnected: boolean;
  callStatus: "idle" | "calling" | "in_call";
  loggedIn: boolean;
  assistantHasConfig?: boolean;
  showMenu: boolean;
  onToggleMenu: () => void;
  onToggleMobileSidebar: () => void;
  onOpenLogin: () => void;
  assistants: AssistantSummary[];
  activeAssistantId: string | null;
  onChangeAssistant: (id: string) => void;
  assistantSelectorDisabled?: boolean;
  t: (key: string) => string;
};

export function Header({
  isDark,
  wsConnected,
  callStatus,
  loggedIn,
  assistantHasConfig,
  showMenu,
  onToggleMenu,
  onToggleMobileSidebar,
  onOpenLogin,
  assistants,
  activeAssistantId,
  onChangeAssistant,
  assistantSelectorDisabled,
  t,
}: HeaderProps) {
  const callActive = callStatus === "calling" || callStatus === "in_call";

  if (callActive) {
    // El header se oculta durante la llamada (comportamiento actual).
    return null;
  }

  return (
    <header
      className={`sticky top-0 z-20 flex h-14 flex-wrap items-center justify-between gap-2 border-b px-3 md:flex border-none`}
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
              onClick={() => {}}
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
