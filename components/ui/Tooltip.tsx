"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  label: string;
  children: React.ReactElement<any>;
  placement?: "auto" | "above" | "below";
  offset?: number;
};

export function Tooltip({
  label,
  children,
  placement = "auto",
  offset = 8,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    align: "center" | "left" | "right";
    placement: "above" | "below";
  }>({ top: 0, left: 0, align: "center", placement: "below" });
  const anchorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const handleScroll = () => setVisible(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [visible]);

  const show = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    let finalPlacement: "above" | "below";
    if (placement === "above" || placement === "below") {
      finalPlacement = placement;
    } else {
      finalPlacement = spaceAbove > spaceBelow ? "above" : "below";
    }

    const top =
      finalPlacement === "below"
        ? rect.bottom + offset
        : rect.top - offset;

    const idealCenter = rect.left + rect.width / 2;

    let align: "center" | "left" | "right" = "center";
    let left = idealCenter;

    const margin = 16;
    if (idealCenter < margin * 2) {
      align = "left";
      left = rect.left;
    } else if (idealCenter > viewportWidth - margin * 2) {
      align = "right";
      left = rect.right;
    }

    setPosition({ top, left, align, placement: finalPlacement });
    setVisible(true);
  };

  const hide = () => setVisible(false);

  const child = React.cloneElement(children as React.ReactElement<any>, {
    "aria-label": label,
  });

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {child}
      </span>
      {visible && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white shadow-sm ${
                position.align === "center"
                  ? "-translate-x-1/2"
                  : position.align === "right"
                  ? "-translate-x-full"
                  : ""
              } ${
                position.placement === "above" ? "-translate-y-full" : ""
              }`}
              style={{ top: position.top, left: position.left }}
              role="tooltip"
            >
              {label}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
