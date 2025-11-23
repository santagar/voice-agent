import React from "react";
import { cn } from "@/lib/cn";
import { labTheme } from "@/lib/theme";

type CardTone = "frosted" | "subtle" | "muted";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  tone?: CardTone;
  padding?: string;
};

const toneClasses: Record<CardTone, string> = {
  frosted: "border-white/10 bg-white/[0.04]",
  subtle: "border-white/10 bg-neutral-900/60",
  muted: "border-white/5 bg-black/40",
};

export function Card({
  children,
  className,
  tone = "frosted",
  padding = "p-4",
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        toneClasses[tone],
        padding,
        className
      )}
      style={{ borderRadius: labTheme.radii.card }}
    >
      {children}
    </div>
  );
}
