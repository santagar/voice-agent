import React from "react";
import { cn } from "@/lib/cn";

type Author = "user" | "assistant" | "system";
type Variant = "lab" | "soft" | "brand";

type ChatBubbleProps = {
  from: Author;
  children: React.ReactNode;
  meta?: string;
  className?: string;
  variant?: Variant;
};

const alignMap: Record<Author, string> = {
  user: "justify-end",
  assistant: "justify-start",
  system: "justify-center",
};

const bubbleStyles: Record<Variant, Record<Author, string>> = {
  lab: {
    user: "bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-lg",
    assistant: "border border-white/10 bg-white/[0.04] text-slate-100",
    system:
      "border border-amber-200/40 bg-amber-500/10 px-2 py-1.5 text-left text-[8px] uppercase tracking-[0.2em] text-amber-100",
  },
  soft: {
    user: "bg-sky-200 text-slate-900 shadow-sm",
    assistant: "bg-white text-slate-800 border border-slate-200",
    system:
      "bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1.5 text-[8px] uppercase tracking-[0.2em]",
  },
  brand: {
    user: "bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-lg",
    assistant:
      "border border-purple-300/40 bg-purple-900/45 text-slate-50 shadow-[0_10px_40px_rgba(126,87,194,0.35)]",
    system:
      "border border-amber-200/40 bg-amber-500/10 px-2 py-1.5 text-left text-[8px] uppercase tracking-[0.2em] text-amber-100",
  },
};

export function ChatBubble({
  from,
  children,
  meta,
  className,
  variant = "lab",
}: ChatBubbleProps) {
  return (
    <article className={cn("flex", alignMap[from])}>
      <div
        className={cn(
          "max-w-xl rounded-3xl px-4 py-3 text-sm leading-relaxed",
          bubbleStyles[variant][from],
          className
        )}
      >
        {children}
        {meta && (
          <span className="ms-2 inline-block text-[7px] font-medium uppercase tracking-[0.15em] text-slate-500">
            {meta}
          </span>
        )}
      </div>
    </article>
  );
}
