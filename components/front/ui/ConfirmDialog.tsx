"use client";

import React from "react";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  helperText?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  helperText,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-black hover:bg-neutral-900 text-white";

  return (
    <Modal open={open} onClose={onCancel}>
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-gray-900 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed">{message}</p>
        {helperText && (
          <p className="mt-2 text-xs text-gray-500">{helperText}</p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-zinc-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex cursor-pointer items-center rounded-full px-4 py-1.5 text-sm font-semibold ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

