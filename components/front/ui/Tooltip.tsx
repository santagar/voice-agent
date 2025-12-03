"use client";

import React, {
  useState,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  placement?: "above" | "below";
  offset?: number;
  /**
   * Horizontal alignment preference relative to the trigger.
   * - "center": center over the trigger (default)
   * - "end": align to the right side of the trigger when possible
   * - "start": align to the left side of the trigger when possible
   */
  align?: "center" | "start" | "end";
};

export function Tooltip({
  label,
  children,
  placement = "below",
  offset = 6,
  align = "center",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : rect.right + 1;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : rect.bottom + 1;
    const margin = 8;
    const verticalMargin = 40;

    // Resolve vertical placement first so we avoid being flush with
    // the top or bottom edges.
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

    // Horizontal placement baseline from the requested alignment.
    let left: number;
    let transform: React.CSSProperties["transform"];

    if (align === "end") {
      // Prefer to sit just to the right of the trigger.
      left = rect.right + margin;
      transform = "translateX(0)";
    } else if (align === "start") {
      // Prefer to sit just to the left of the trigger.
      left = rect.left - margin;
      transform = "translateX(-100%)";
    } else {
      // Default: center on the trigger.
      left = rect.left + rect.width / 2;
      transform = "translateX(-50%)";
    }

    const closeToLeft = rect.left < 80;
    const closeToRight = viewportWidth - rect.right < 80;

    if (closeToLeft) {
      // Anchor to the right of the trigger.
      left = rect.right + margin;
      transform = "translateX(0)";
    } else if (closeToRight) {
      // Anchor to the left of the trigger.
      left = rect.left - margin;
      transform = "translateX(-100%)";
    }

    setStyle({
      top,
      left,
      transform,
    });
  }, [visible, placement, offset]);

  const tooltipNode =
    visible && mounted
      ? createPortal(
          <div
            className="pointer-events-none fixed z-[999] max-w-xs whitespace-nowrap rounded-md bg-black px-2 py-1 text-[11px] font-medium text-white shadow-lg"
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
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {tooltipNode}
    </>
  );
}
