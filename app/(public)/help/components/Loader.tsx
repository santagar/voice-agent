"use client";

import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";

export function Loader() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const text = isDark ? "text-zinc-200" : "text-slate-700";
  const bg = isDark ? "bg-neutral-800/80 border-white/10" : "bg-white/80 border-slate-200";

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${bg}`}>
      <Loader2 className={`h-5 w-5 animate-spin ${text}`} />
      <p className={`text-sm ${text}`}>Loading…</p>
    </div>
  );
}
