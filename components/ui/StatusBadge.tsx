import React from "react";
import { cn } from "@/lib/cn";

export type SessionStatus = "idle" | "calling" | "in_call";

const STATUS_STYLES: Record<
  SessionStatus,
  { label: string; className: string }
> = {
  idle: { label: "Idle", className: "bg-slate-700/70" },
  calling: { label: "Dialing…", className: "bg-amber-500/20 text-amber-200" },
  in_call: {
    label: "Live session",
    className: "bg-emerald-500/20 text-emerald-200",
  },
};

type StatusBadgeProps = {
  status: SessionStatus;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const preset = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        preset.className,
        className
      )}
    >
      {label ?? preset.label}
    </span>
  );
}

export const statusPresets = STATUS_STYLES;
