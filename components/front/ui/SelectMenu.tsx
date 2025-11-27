"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectMenuOption = {
  value: string;
  label: string;
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
};

export function SelectMenu({
  value,
  options,
  onChange,
  triggerLabel,
  isDark,
  align = "right",
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
          isDark
            ? "bg-transparent text-gray-100 hover:bg-white/10"
            : "bg-transparent text-gray-800 hover:bg-zinc-100"
        }`}
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 opacity-80" />
      </button>
      {open && (
        <div
          className={`absolute z-40 mt-1 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
            align === "right" ? "right-0" : "left-0"
          } ${
            isDark
              ? "border-white/10 bg-neutral-800/95"
              : "border-zinc-200 bg-white"
          }`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-[14px] cursor-pointer ${
                isDark
                  ? "text-gray-100 hover:bg-white/10"
                  : "text-gray-800 hover:bg-zinc-50"
              }`}
            >
              <span className="flex-1 text-left">{option.label}</span>
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

