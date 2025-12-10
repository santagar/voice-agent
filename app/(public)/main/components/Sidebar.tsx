"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import { IconButton } from "@/components/front/ui/IconButton";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { UserMenu } from "./UserMenu";
import { useSession } from "../context/SessionContext";
import { useApiConversations } from "@/hooks/useApiConversations";
import { SearchModal } from "./SearchModal";

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
  showMobileSidebar: boolean;
  initialSidebarCollapsed?: boolean;
  chats: ChatSummary[];
  activeChatId: string | null;
  t: (key: string) => string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenPlatform: () => void;
  onFocusInput?: () => void;
  onCloseMobileSidebar?: () => void;
  onArchiveChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onRenameChat?: (id: string, title: string) => void;
  onChatsChange?: (chats: ChatSummary[]) => void;
};

export function Sidebar({
  isDark,
  showMobileSidebar,
  initialSidebarCollapsed,
  onCloseMobileSidebar,
  ...rest
}: SidebarProps) {
  const { userEmail, userName, userImage, isAdminUser, signOut } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const cookie = document.cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("va-sidebar-collapsed="));
      if (cookie) {
        const [, value] = cookie.split("=");
        if (value === "true") return true;
        if (value === "false") return false;
      }
    } catch {
      // ignore cookie read errors, fall back to prop
    }
    return initialSidebarCollapsed ?? false;
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const handleToggle = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      document.cookie = `va-sidebar-collapsed=${
        next ? "true" : "false"
      }; path=/; max-age=31536000`;
    } catch {
      // best-effort only
    }
  };

  return (
    <>
      {/* Desktop sidebar (md and up) */}
      <aside
        className={`relative hidden h-full flex-col border-r backdrop-blur-xl md:flex ${
          isDark
            ? sidebarCollapsed
              ? "border-white/5 bg-neutral-800/80"
              : "border-white/5 bg-neutral-900"
            : sidebarCollapsed
            ? "border-zinc-200/60 bg-white/70"
            : "border-zinc-200/60 bg-zinc-50"
        }`}
        style={{ width: sidebarCollapsed ? 52 : 260 }}
      >
        <SidebarContent
          {...rest}
          isDark={isDark}
          sidebarCollapsed={sidebarCollapsed}
          showMobileSidebar={false}
          onToggleSidebarCollapse={handleToggle}
          onToggleUserMenu={() => setShowUserMenu((prev) => !prev)}
        />
      </aside>

      {/* Mobile sidebar (below md) */}
      {showMobileSidebar && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={onCloseMobileSidebar}
            aria-hidden
          />
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex h-full w-[60vw] max-w-sm flex-col border-r shadow-2xl backdrop-blur-xl md:hidden ${
              isDark
                ? "border-white/5 bg-neutral-800/90"
                : "border-zinc-200/60 bg-white"
            }`}
          >
            <SidebarContent
              {...rest}
              isDark={isDark}
              sidebarCollapsed={false}
              showMobileSidebar={true}
              onToggleSidebarCollapse={() => undefined}
              onCloseMobileSidebar={onCloseMobileSidebar}
              onToggleUserMenu={() => setShowUserMenu((prev) => !prev)}
            />
          </aside>
        </>
      )}

      <UserMenu
        show={showUserMenu}
        isDark={isDark}
        t={rest.t}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
        isAdminUser={isAdminUser}
        onClose={() => setShowUserMenu(false)}
        onOpenPlatform={() => {
          setShowUserMenu(false);
          rest.onOpenPlatform();
        }}
        onSignOut={async () => {
          await signOut();
          setShowUserMenu(false);
        }}
      />
    </>
  );
}

type SidebarContentProps = Omit<
  SidebarProps,
  "showMobileSidebar" | "initialSidebarCollapsed"
> & {
  showMobileSidebar: boolean;
  onToggleUserMenu: () => void;
  onToggleSidebarCollapse: () => void;
  sidebarCollapsed: boolean;
};

function SidebarContent({
  isDark,
  showMobileSidebar,
  sidebarCollapsed,
  chats,
  activeChatId,
  t,
  onToggleSidebarCollapse,
  onNewChat,
  onSelectChat,
  onOpenSettings,
  onFocusInput,
  onToggleUserMenu,
  onCloseMobileSidebar,
  onArchiveChat,
  onDeleteChat,
  onRenameChat,
  onChatsChange,
}: SidebarContentProps) {
  const { loggedIn, userEmail, userName, userImage } = useSession();
  const { listConversations, searchConversations } = useApiConversations();
  const listConversationsRef = useRef(listConversations);
  const searchConversationsRef = useRef(searchConversations);
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { conversationId: string; title: string; snippet?: string | null }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const [chatListScrollable, setChatListScrollable] = useState(false);
  const orderedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt;
      const bDate = b.updatedAt || b.createdAt;
      return bDate.localeCompare(aDate);
    });
  }, [chats]);

  // Global keyboard shortcuts: new chat (⇧⌘O) and focus input (⌘K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "o" && e.shiftKey) {
        e.preventDefault();
        onNewChat();
        return;
      }
      if (key === "k") {
        e.preventDefault();
        setShowSearchModal(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewChat]);

  useEffect(() => {
    listConversationsRef.current = listConversations;
    searchConversationsRef.current = searchConversations;
  }, [listConversations, searchConversations]);

  useEffect(() => {
    if (!showSearchModal) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const id = window.setTimeout(() => {
      searchConversationsRef.current(trimmed)
        .then((res) => {
          if (cancelled) return;
          setSearchResults(res);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to search chats:", err);
          setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [
    searchQuery,
    showSearchModal,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadChats() {
      try {
        const data = await listConversationsRef.current();
        if (cancelled) return;
        const summaries: ChatSummary[] = data.map(
          (c: {
            id: string;
            title: string;
            mode?: ChatSummaryMode;
            createdAt: string;
            updatedAt: string;
            lastMessageAt: string | null;
          }) => ({
            id: c.id,
            title: c.title,
            mode: c.mode ?? "unknown",
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            lastMessageFrom: null,
            lastMessageAt: c.lastMessageAt,
          })
        );
        onChatsChange?.(summaries);
      } catch (err) {
        console.error("Failed to load chats:", err);
      }
    }
    void loadChats();
    return () => {
      cancelled = true;
    };
  }, [onChatsChange]);

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

  useEffect(() => {
    function recomputeScroll() {
      const el = chatListRef.current;
      if (!el || !chatsExpanded) {
        setChatListScrollable(false);
        return;
      }
      setChatListScrollable(el.scrollHeight > el.clientHeight + 2);
    }
    recomputeScroll();
    window.addEventListener("resize", recomputeScroll);
    return () => window.removeEventListener("resize", recomputeScroll);
  }, [chatsExpanded, orderedChats.length]);

  useEffect(() => {
    if (!showSearchModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSearchModal(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSearchModal]);

  const handleSearchSelect = (conversationId: string) => {
    setShowSearchModal(false);
    setSearchQuery("");
    setSearchResults([]);
    onSelectChat(conversationId);
    if (showMobileSidebar && onCloseMobileSidebar) {
      onCloseMobileSidebar();
    }
  };

  const hasChatSection = !sidebarCollapsed && chats.length > 0;
  const userBlockBorder =
    hasChatSection && chatListScrollable
      ? isDark
        ? "border-t border-white/10"
        : "border-t border-zinc-200"
      : "";

  return (
    <div className="flex h-full flex-col">
      {/* Header / collapse controls */}
      <div className="flex items-center gap-2 px-2 py-2 shrink-0">
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

      {/* Body: actions + chats scrollable area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="mt-2 space-y-1 px-2 shrink-0">
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
              } else if (key === "search") {
                setShowSearchModal(true);
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

        {hasChatSection && (
          <div className="mt-5 flex-1 min-h-0 px-2 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => setChatsExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              <span className={isDark ? "text-gray-400" : "text-gray-500"}>
                {t("chat.sidebar.chatsLabel")}
              </span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  chatsExpanded ? "rotate-0" : "-rotate-90"
                } ${isDark ? "text-gray-400" : "text-gray-500"}`}
              />
            </button>

            {chatsExpanded && (
              <div
                ref={chatListRef}
                className="mt-1 flex-1 min-h-0 space-y-1 overflow-y-auto pr-1 pb-3"
              >
                {orderedChats.map((chat) => {
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
                            <span className="block truncate">{chat.title}</span>
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
                            className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 transition ${
                              isDark
                                ? "text-gray-300 hover:text-white hover:bg-white/10"
                                : "text-gray-500 hover:text-gray-900 hover:bg-zinc-200/60"
                            } cursor-pointer`}
                            aria-label={t("chat.sidebar.chatMenu.open")}
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
                          onClick={() => setOpenChatMenuId(null)}
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
                                {t("chat.sidebar.rename")}
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
      </div>

      {/* User block fixed at bottom */}
      {loggedIn && (
        <div className={`px-2 py-3 shrink-0 ${userBlockBorder}`}>
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

      <SearchModal
        open={showSearchModal}
        isDark={isDark}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchLoading={searchLoading}
        recentChats={orderedChats}
        onChangeQuery={setSearchQuery}
        onClose={() => {
          setShowSearchModal(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
        onSelect={handleSearchSelect}
        t={t}
      />
    </div>
  );
}
