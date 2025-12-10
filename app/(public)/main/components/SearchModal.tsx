"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Search, X } from "lucide-react";

type SearchResult = {
  conversationId: string;
  title: string;
  snippet?: string | null;
  lastMessageAt?: string | null;
};

type SearchModalProps = {
  open: boolean;
  isDark: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  recentChats?: { id: string; title: string; updatedAt?: string }[];
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
  t: (key: string, fallback?: string) => string;
};

export function SearchModal({
  open,
  isDark,
  searchQuery,
  searchResults,
  searchLoading,
  recentChats = [],
  onChangeQuery,
  onClose,
  onSelect,
  t,
}: SearchModalProps) {
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!mounted || !open) return null;

  const trimmed = searchQuery.trim();
  let resultsContent: React.ReactNode;

  if (!trimmed) {
    const buckets = { today: [] as typeof recentChats, yesterday: [] as typeof recentChats, week: [] as typeof recentChats };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    recentChats.forEach((chat) => {
      if (!chat.updatedAt) return;
      const ts = new Date(chat.updatedAt).getTime();
      const diffDays = Math.floor((todayStart - ts) / msPerDay);
      if (diffDays <= 0) {
        buckets.today.push(chat);
      } else if (diffDays === 1) {
        buckets.yesterday.push(chat);
      } else if (diffDays < 7) {
        buckets.week.push(chat);
      }
    });

    const renderBucket = (label: string, items: typeof recentChats) =>
      items.length ? (
        <div className="flex flex-col gap-1">
          <span className={`px-4 pt-2 text-xs uppercase tracking-[0.14em] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {label}
          </span>
          {items.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelect(chat.id)}
              className={`group flex w-full items-center gap-2 px-4 py-3 text-left transition rounded-xl ${
                isDark ? "hover:bg-white/10 text-white" : "hover:bg-zinc-100 text-slate-900"
              }`}
            >
              <MessageSquare className="h-4 w-4 opacity-80 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm font-medium">
                {chat.title}
              </span>
              {chat.updatedAt && (
                <span
                  className={`hidden w-16 shrink-0 text-right text-xs ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  } group-hover:inline-block`}
                >
                  {new Date(chat.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null;

    resultsContent = (
      <div className="max-h-[60vh] overflow-y-auto py-2 flex flex-col gap-4">
        {renderBucket(t("chat.sidebar.today", "Today"), buckets.today)}
        {renderBucket(t("chat.sidebar.yesterday", "Yesterday"), buckets.yesterday)}
        {renderBucket(t("chat.sidebar.previous7", "Previous 7 Days"), buckets.week)}
      </div>
    );
  } else if (searchLoading) {
    resultsContent = (
      <div className="flex items-center gap-2 px-4 py-4 text-sm">
        <div
          className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
            isDark ? "border-gray-500" : "border-gray-400"
          }`}
        />
        <span className={isDark ? "text-gray-200" : "text-gray-700"}>
          {t("common.loading", "Loading…")}
        </span>
      </div>
    );
  } else if (!searchResults.length) {
    resultsContent = (
      <div
        className={`px-4 py-2 text-sm ${
          isDark ? "text-gray-400" : "text-gray-600"
        }`}
      >
        <div className="mt-1">
          {t("chat.sidebar.empty", "No results.")}
        </div>
      </div>
    );
  } else {
    resultsContent = (
      <div className="max-h-[60vh] overflow-y-auto">
        {searchResults.map((result) => (
          <button
            key={result.conversationId}
            type="button"
            onClick={() => onSelect(result.conversationId)}
            className={`group relative flex w-full flex-col gap-1 px-4 py-3 rounded-xl text-left transition ${
              isDark
                ? "hover:bg-white/10 text-white"
                : "hover:bg-zinc-100 text-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 opacity-80 shrink-0" />
              <span className="flex-1 min-w-0 truncate">{result.title}</span>
              {result.lastMessageAt && (
                <span
                  className={`hidden w-16 shrink-0 text-right text-xs ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  } group-hover:inline-block`}
                >
                  {new Date(result.lastMessageAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            {result.snippet ? (
              <p
                className={`max-h-12 overflow-hidden text-sm line-clamp-2 break-words pr-2 ${
                  isDark ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {result.snippet}
              </p>
            ) : null}
          </button>
        ))}
      </div>
    );
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-3 py-8"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl backdrop-blur-xl ${
          isDark
            ? "border-white/10 bg-neutral-700/95"
            : "border-zinc-200 bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center gap-3 px-5 py-3 ${
            isDark ? "border-b border-white/5" : "border-b border-zinc-200"
          }`}
        >
          <Search
            className={`h-5 w-5 ${
              isDark ? "text-gray-300" : "text-gray-500"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder={t("chat.sidebar.search")}
            className={`flex-1 bg-transparent text-base outline-none ${
              isDark
                ? "text-white placeholder:text-gray-500"
                : "text-gray-900 placeholder:text-gray-500"
            }`}
          />
          <button
            type="button"
            onClick={onClose}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
              isDark
                ? "text-gray-300 hover:bg-white/10"
                : "text-gray-700 hover:bg-zinc-100"
            }`}
            aria-label={t("common.close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="py-2 px-1 min-h-[320px]">{resultsContent}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
