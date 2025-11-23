import React from "react";
import { cn } from "@/lib/cn";
import { labTheme } from "@/lib/theme";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ title, onClose, children, className }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full max-w-2xl rounded-3xl border border-white/10 bg-neutral-900/95 p-6",
          className
        )}
        style={{
          borderRadius: labTheme.radii.modal,
          boxShadow: labTheme.shadows.modal,
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300 transition hover:border-white/50"
          >
            Close
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
