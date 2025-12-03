"use client";

import React, { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

type InfoPopoverProps = {
  label: ReactNode;
  children: ReactNode;
  isDark?: boolean;
  placement?: "above" | "below";
  offset?: number;
};

export function InfoPopover({
  label,
  children,
  isDark = false,
  placement = "below",
  offset = 10,
}: InfoPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : rect.bottom + 1;
    const verticalMargin = 40;

    let resolvedPlacement = placement;
    if (rect.top < verticalMargin) {
      resolvedPlacement = "below";
    } else if (rect.bottom > viewportHeight - verticalMargin) {
      resolvedPlacement = "above";
    }

    const top =
      resolvedPlacement === "above"
        ? rect.top - offset
        : rect.bottom + offset;
    const left = rect.left;

    setStyle({ top, left });
  }, [visible, placement, offset]);

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const open = () => {
    clearHideTimeout();
    setVisible(true);
  };

  const scheduleClose = () => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => setVisible(false), 60);
  };

  const node =
    visible && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
            className={`pointer-events-auto fixed z-[999] max-w-sm whitespace-pre-line rounded-2xl border px-4 py-3 text-sm leading-5 shadow-lg ${
              isDark
                ? "border-white/10 bg-neutral-900 text-zinc-50"
                : "border-black/10 bg-white text-slate-900"
            }`}
            style={style}
          >
            {label}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={ref}
        className="relative inline-flex"
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
      >
        {children}
      </div>
      {node}
    </>
  );
}
