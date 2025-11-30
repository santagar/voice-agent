"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectMenuOption = {
  value: string;
  label: string;
  description?: string;
};

type SelectMenuProps = {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  /**
   * Optional explicit label for the trigger. When omitted, the label of the
   * currently selected option is used.
   */
  triggerLabel?: string;
  isDark?: boolean;
  align?: "left" | "right";
  /**
   * Optional custom classes for the trigger button and label. When omitted,
   * the default compact style used across the app is applied.
   */
  triggerClassName?: string;
  labelClassName?: string;
  /**
   * When true, the dropdown will match the full width
   * of the trigger container instead of a fixed width.
   */
  fullWidth?: boolean;
};

export function SelectMenu({
  value,
  options,
  onChange,
  triggerLabel,
  isDark,
  align = "right",
  triggerClassName,
  labelClassName,
  fullWidth,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const label = triggerLabel ?? selected?.label ?? "";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={fullWidth ? "relative w-full" : "relative"}
    >
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={
          triggerClassName ??
          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
            isDark
              ? "bg-transparent text-gray-100 hover:bg-white/10"
              : "bg-transparent text-gray-800 hover:bg-zinc-100"
          } ${fullWidth ? "w-full justify-between" : ""}`
        }
      >
        <span className={labelClassName}>{label}</span>
        <ChevronDown className="h-4 w-4 opacity-80" />
      </button>
      {open && (
        <div
          className={`absolute z-40 mt-1 w-60 rounded-xl border shadow-lg backdrop-blur-sm ${
            align === "right" ? "right-0" : "left-0"
          } ${
            isDark
              ? "border-white/10 bg-neutral-800/95"
              : "border-zinc-200 bg-white"
          } ${fullWidth ? "w-full" : ""}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`mx-1 my-0.5 flex w-[calc(100%-0.5rem)] items-start gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                isDark
                  ? "text-gray-100 hover:bg-white/10"
                  : "text-gray-800 hover:bg-zinc-50"
              } ${fullWidth ? "mx-0 w-full" : ""}`}
            >
              <div className="flex-1 text-left">
                <div className="font-medium">{option.label}</div>
                {option.description && (
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </div>
                )}
              </div>
              {value === option.value && (
                <Check className="h-4 w-4 text-gray-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
