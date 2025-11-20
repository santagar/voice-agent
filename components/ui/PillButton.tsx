import React from "react";
import { cn } from "@/lib/cn";

type PillTone = "neutral" | "accent";

type PillButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  tone?: PillTone;
};

export function PillButton({
  active = false,
  tone = "neutral",
  className,
  children,
  type = "button",
  ...props
}: PillButtonProps) {
  const toneClasses: Record<PillTone, string> = {
    neutral:
      "border-white/10 text-slate-300 hover:border-white/30 hover:text-white",
    accent:
      "border-emerald-400/60 text-emerald-100 hover:border-emerald-400 hover:text-emerald-50",
  };
  return (
    <button
      type={type}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none",
        toneClasses[tone],
        active && "bg-white/10 text-white",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
