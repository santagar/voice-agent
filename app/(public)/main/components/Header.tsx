"use client";

import React from "react";
import { Ellipsis, Menu } from "lucide-react";
import { IconButton } from "@/components/front/ui/IconButton";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { SelectMenu } from "@/components/front/ui/SelectMenu";

export type AssistantSummary = {
  id: string;
  name: string;
  description?: string | null;
};

type HeaderProps = {
  isDark: boolean;
  wsConnected: boolean;
  callStatus: "idle" | "calling" | "in_call";
  loggedIn: boolean;
  showMenu: boolean;
  onToggleMenu: () => void;
  onToggleMobileSidebar: () => void;
  onOpenLogin: () => void;
  assistants: AssistantSummary[];
  activeAssistantId: string | null;
  onChangeAssistant: (id: string) => void;
  t: (key: string) => string;
};

export function ChatHeader({
  isDark,
  wsConnected,
  callStatus,
  loggedIn,
  showMenu,
  onToggleMenu,
  onToggleMobileSidebar,
  onOpenLogin,
  assistants,
  activeAssistantId,
  onChangeAssistant,
  t,
}: HeaderProps) {
  const callActive = callStatus === "calling" || callStatus === "in_call";
  const assistantOptions =
    assistants.length > 0
      ? assistants
      : [{ id: "default", name: "Voice Agent" }];
  const selectedId =
    activeAssistantId &&
    assistantOptions.some((a) => a.id === activeAssistantId)
      ? activeAssistantId
      : assistantOptions[0]?.id ?? null;

  if (callActive) {
    // El header se oculta durante la llamada (comportamiento actual).
    return null;
  }

  return (
    <header
      className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-2 py-2 transition-colors md:flex ${
        isDark ? "bg-neutral-800" : "bg-transparent"
      }`}
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
              wsConnected ? "dot-online" : "dot-offline"
            } ml-2 mr-1 h-2.5 w-2.5`}
            aria-hidden
          />
          <div className="-ml-1.5">
            <SelectMenu
              isDark={isDark}
              value={selectedId ?? ""}
              options={assistantOptions.map((a) => ({
                value: a.id,
                label: a.name,
                description: a.description ?? undefined,
              }))}
              align="left"
              triggerClassName={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
                isDark
                  ? "bg-transparent text-gray-100"
                  : "bg-transparent text-gray-800"
              }`}
              labelClassName="truncate text-lg"
              onChange={(id) => {
                if (!id) return;
                onChangeAssistant(id);
              }}
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
        )}
      </div>
    </header>
  );
}
