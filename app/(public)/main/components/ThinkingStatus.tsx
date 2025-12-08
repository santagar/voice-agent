"use client";

type ThinkingStatusProps = {
  show: boolean;
  isDark: boolean;
  t: (key: string) => string;
  className?: string;
};

export function ThinkingStatus({ show, isDark, t, className }: ThinkingStatusProps) {
  if (!show) return null;
  return (
    <div className={`mx-auto w-full max-w-3xl px-1 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span
          className={`status-dot dot-online ${
            isDark ? "bg-emerald-400" : ""
          }`}
        />
        {t("chat.status.thinking")}
      </div>
    </div>
  );
}
