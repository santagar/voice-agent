"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Aperture,
  Archive,
  ChevronDown,
  Edit3,
  Ellipsis,
  MessageSquare,
  PanelLeft,
  Search,
  Settings,
  Trash2,
  User,
  UserCircle2,
  X,
} from "lucide-react";
import { IconButton } from "@/components/front/ui/IconButton";
import { Tooltip } from "@/components/front/ui/Tooltip";

export type ChatSummaryMode = "text" | "voice" | "mixed" | "unknown";

export type ChatSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageFrom: "user" | "assistant" | null;
  lastMessageAt: string | null;
  mode: ChatSummaryMode;
};

export type SidebarProps = {
  isDark: boolean;
  sidebarCollapsed: boolean;
  showMobileSidebar: boolean;
  chats: ChatSummary[];
  activeChatId: string | null;
  loggedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  userImage: string | null;
  isAdminUser: boolean;
  t: (key: string) => string;
  onToggleSidebarCollapse: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenPlatform: () => void;
  onToggleUserMenu: () => void;
  showUserMenu: boolean;
  onCloseMobileSidebar?: () => void;
  onArchiveChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onRenameChat?: (id: string, title: string) => void;
};

export function Sidebar({
  isDark,
  sidebarCollapsed,
  showMobileSidebar,
  chats,
  activeChatId,
  loggedIn,
  userEmail,
  userName,
  userImage,
  isAdminUser,
  t,
  onToggleSidebarCollapse,
  onNewChat,
  onSelectChat,
  onOpenSettings,
  onOpenPlatform,
  onToggleUserMenu,
  showUserMenu,
  onCloseMobileSidebar,
  onArchiveChat,
  onDeleteChat,
  onRenameChat,
}: SidebarProps) {
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const chatMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openChatMenuId) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        chatMenuRef.current &&
        !chatMenuRef.current.contains(event.target as Node)
      ) {
        setOpenChatMenuId(null);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openChatMenuId]);

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-2">
        <IconButton
          onClick={() => {
            if (sidebarCollapsed && !showMobileSidebar) {
              onToggleSidebarCollapse();
            }
          }}
          className={`group rounded-xl ${
            isDark
              ? "hover:bg-white/10"
              : (!sidebarCollapsed || showMobileSidebar)
              ? "hover:bg-zinc-200"
              : ""
          }`}
          isDark={isDark}
          aria-label={
            sidebarCollapsed
              ? t("chat.aria.sidebar.expand")
              : t("chat.aria.sidebar.menu")
          }
        >
          {sidebarCollapsed ? (
            <>
              <Aperture className="h-5 w-5 group-hover:hidden" />
              <PanelLeft className="hidden h-5 w-5 group-hover:inline-block" />
            </>
          ) : (
            <Aperture className="h-5 w-5" />
          )}
        </IconButton>
        {!sidebarCollapsed && !showMobileSidebar && (
          <IconButton
            className={`ml-auto rounded-xl text-sm font-semibold ${
              isDark ? "text-gray-400" : "text-gray-500"
            } ${
              isDark
                ? "hover:bg-white/10"
                : !sidebarCollapsed && !showMobileSidebar
                ? "hover:bg-zinc-200"
                : ""
            }`}
            isDark={isDark}
            onClick={onToggleSidebarCollapse}
          >
            <Tooltip label={t("chat.sidebar.collapse")}>
              <span>
                <PanelLeft className="h-5 w-5" />
              </span>
            </Tooltip>
          </IconButton>
        )}
        {showMobileSidebar && (
          <IconButton
            className={`ml-auto rounded-xl ${
              isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"
            }`}
            isDark={isDark}
            onClick={onCloseMobileSidebar}
            aria-label={t("chat.sidebar.close")}
          >
            <X className="h-5 w-5" />
          </IconButton>
        )}
      </div>

      <div className="mt-2 space-y-1 px-2">
        {["new", "search", "settings"].map((key) => {
          const icon =
            key === "new"
              ? MessageSquare
              : key === "search"
              ? Search
              : Settings;
          const Icon = icon;
          const label =
            key === "new"
              ? t("chat.sidebar.newChat")
              : key === "search"
              ? t("chat.sidebar.search")
              : t("chat.sidebar.settings");
          const shortcut =
            key === "new" ? "⇧ ⌘ O" : key === "search" ? "⌘ K" : "";
          const handleClick = () => {
            if (key === "settings") {
              onOpenSettings();
            } else if (key === "new") {
              onNewChat();
            }
            if (showMobileSidebar && onCloseMobileSidebar) {
              onCloseMobileSidebar();
            }
          };

          return (
            <button
              key={key}
              className={`group flex w-full items-center rounded-xl px-2 py-2 text-left transition cursor-pointer ${
                isDark
                  ? "hover:bg-white/10"
                  : sidebarCollapsed
                  ? "hover:bg-zinc-100"
                  : "hover:bg-zinc-200"
              }`}
              type="button"
              onClick={handleClick}
            >
              {sidebarCollapsed && !showMobileSidebar ? (
                <Tooltip
                  label={
                    shortcut ? (
                      <span className="flex items-center gap-2">
                        <span>{label}</span>
                        <span className="text-zinc-400">{shortcut}</span>
                      </span>
                    ) : (
                      label
                    )
                  }
                >
                  <div className="flex w-full justify-center">
                    <Icon
                      className={`h-5 w-5 ${
                        isDark ? "text-slate-200" : "text-slate-700"
                      }`}
                    />
                  </div>
                </Tooltip>
              ) : (
                <>
                  <div className="flex flex-1 items-center gap-3">
                    <Icon
                      className={`h-5 w-5 ${
                        isDark ? "text-slate-200" : "text-slate-700"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        isDark ? "text-slate-100" : "text-slate-900"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {key === "new" && (
                    <span className="ml-auto mr-1 text-xs font-medium text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-gray-500 transition-opacity">
                      ⇧ ⌘ O
                    </span>
                  )}
                  {key === "search" && (
                    <span className="ml-auto mr-1 text-xs font-medium text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-gray-500 transition-opacity">
                      ⌘ K
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {!sidebarCollapsed && chats.length > 0 && (
        <div className="mt-5 px-2">
          <button
            type="button"
            onClick={() => setChatsExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          >
            <span
              className={
                isDark ? "text-gray-400" : "text-gray-500"
              }
            >
              {t("chat.sidebar.chatsLabel")}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                chatsExpanded ? "rotate-0" : "-rotate-90"
              } ${isDark ? "text-gray-400" : "text-gray-500"}`}
            />
          </button>

          {chatsExpanded && (
            <div className="mt-1 space-y-1">
              {chats.map((chat) => {
                const isActive = chat.id === activeChatId;
                const isEditing = editingChatId === chat.id;
                const handleClick = () => {
                  if (isEditing) return;
                  onSelectChat(chat.id);
                  if (showMobileSidebar && onCloseMobileSidebar) {
                    onCloseMobileSidebar();
                  }
                };
                const showMenu = openChatMenuId === chat.id;

                const handleRenameCommit = () => {
                  if (!editingChatId) return;
                  const trimmed = editingTitle.trim();
                  if (!trimmed || trimmed === chat.title) {
                    setEditingChatId(null);
                    return;
                  }
                  onRenameChat?.(chat.id, trimmed);
                  setEditingChatId(null);
                };

                return (
                  <div key={chat.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      className={`group relative flex w-full items-center rounded-xl px-2 py-2 text-left text-sm transition cursor-pointer ${
                        isActive
                          ? isDark
                            ? "bg-white/10 text-white"
                            : "bg-zinc-100 text-slate-900"
                          : isDark
                          ? "text-gray-200 hover:bg-white/10"
                          : "text-gray-800 hover:bg-zinc-100"
                      }`}
                      onClick={handleClick}
                      onKeyDown={(e) => {
                        if (isEditing) return;
                        const target = e.target as HTMLElement;
                        if (target.tagName === "INPUT") return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleClick();
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-6">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleRenameCommit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingChatId(null);
                              }
                            }}
                            onBlur={handleRenameCommit}
                            className={`w-full bg-transparent text-sm outline-none border-none ${
                              isDark ? "text-white" : "text-slate-900"
                            }`}
                          />
                        ) : (
                          <span className="block truncate">
                            {chat.title}
                          </span>
                        )}
                      </div>
                      {!sidebarCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenChatMenuId((prev) =>
                              prev === chat.id ? null : chat.id
                            );
                          }}
                          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-gray-500 opacity-0 group-hover:opacity-100 group-hover:text-gray-900 transition-opacity cursor-pointer"
                          aria-label={t("chat.sidebar.chatMenu.open", "Open chat menu")}
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {showMenu && (
                      <div
                        ref={chatMenuRef}
                        className={`absolute right-0 top-9 z-50 w-44 rounded-xl border shadow-lg backdrop-blur-sm ${
                            isDark
                              ? "border-white/10 bg-neutral-800/95"
                              : "border-zinc-200 bg-white"
                          }`}
                      >
                          <div className="px-1 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                              setEditingChatId(chat.id);
                              setEditingTitle(chat.title);
                                setOpenChatMenuId(null);
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                                isDark
                                  ? "text-slate-100 hover:bg-white/10"
                                  : "text-slate-800 hover:bg-zinc-50"
                              }`}
                            >
                              <Edit3 className="h-4 w-4" />
                              <span className="flex-1 text-left">
                                {t("chat.sidebar.rename", "Rename")}
                              </span>
                            </button>
                          </div>
                          <div
                            className={`mx-2 my-1 h-px ${
                              isDark ? "bg-white/10" : "bg-zinc-200"
                            }`}
                          />
                          <div className="px-1 pb-1">
                            <button
                              type="button"
                              onClick={() => {
                                onArchiveChat?.(chat.id);
                                setOpenChatMenuId(null);
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                                isDark
                                  ? "text-slate-100 hover:bg-white/10"
                                  : "text-slate-800 hover:bg-zinc-50"
                              }`}
                            >
                              <Archive className="h-4 w-4" />
                              <span className="flex-1 text-left">
                                {t("chat.menu.archive")}
                              </span>
                            </button>
                          </div>
                          <div className="px-1 pb-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteChat?.(chat.id);
                                setOpenChatMenuId(null);
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                                isDark
                                  ? "text-red-300 hover:bg-red-500/10"
                                  : "text-red-600 hover:bg-red-50"
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="flex-1 text-left">
                                {t("chat.menu.delete")}
                              </span>
                            </button>
                          </div>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loggedIn && (
        <div className="mt-auto px-2 py-3">
          <button
            type="button"
            onClick={onToggleUserMenu}
            className={`group flex items-center rounded-xl text-left text-sm transition ${
              sidebarCollapsed && !showMobileSidebar
                ? "mx-auto h-10 w-10 items-center justify-center"
                : "w-full gap-3 px-2 py-2"
            } ${
              isDark
                ? "hover:bg-white/10"
                : sidebarCollapsed
                ? "hover:bg-zinc-100"
                : "hover:bg-zinc-200"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 overflow-hidden">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt={userName || userEmail || "User avatar"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User
                  className={`h-5 w-5 ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="ml-2 flex flex-1 flex-col">
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
            )}
          </button>
        </div>
      )}

      {/* The actual user menu popover is rendered at the root level
          in the main Client component so it can float above both
          sidebar and content. Sidebar is responsible only for the
          trigger button. */}
    </>
  );
}
