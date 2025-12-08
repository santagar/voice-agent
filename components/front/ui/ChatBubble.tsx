"use client";

import React from "react";

type ChatBubbleProps = {
  from: "user" | "assistant" | "system";
  children: React.ReactNode;
  meta?: React.ReactNode | null;
  variant?: "chat";
  className?: string;
};

export function ChatBubble({
  from,
  children,
  meta,
  variant = "chat",
  className = "",
}: ChatBubbleProps) {
  const isUser = from === "user";

  const base =
    "inline-flex rounded-2xl py-1.5 text-md";

  // Slight asymmetric padding so user and assistant bubbles feel visually
  // balanced without adding extra left padding for the user messages.
  const padding = "px-3.5";

  const palette =
    variant === "chat"
      ? isUser
        ? "bg-sky-500 text-white"
        : "bg-white/5 text-slate-100"
      : isUser
      ? "bg-sky-500 text-white"
      : "bg-zinc-800 text-slate-100";

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex flex-col gap-1 ${
          isUser ? "items-end text-right" : "items-start text-left"
        }`}
      >
        <div className={`${base} ${padding} ${palette} ${className}`}>
          {children}
        </div>
        {meta && (
          <div
            className={`flex items-center gap-1 text-[12px] leading-tight text-gray-500 ${
              isUser ? "justify-end pt-1 pr-2" : "justify-start"
            }`}
          >
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
