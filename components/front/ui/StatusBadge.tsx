"use client";

import React from "react";

type StatusBadgeProps = {
  label: string;
  variant?: "default" | "success" | "warning" | "error";
};

export function StatusBadge({
  label,
  variant = "default",
}: StatusBadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-medium";

  const styles =
    variant === "success"
      ? "bg-emerald-500/10 text-emerald-300"
      : variant === "warning"
      ? "bg-amber-500/10 text-amber-300"
      : variant === "error"
      ? "bg-rose-500/10 text-rose-300"
      : "bg-white/10 text-slate-100";

  return <span className={`${base} ${styles}`}>{label}</span>;
}

