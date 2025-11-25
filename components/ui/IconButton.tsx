"use client";

import React from "react";

type IconButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
  disabled?: boolean;
  /**
   * Visual size of the button. Mapped to fixed square sizes.
   */
  size?: "sm" | "md";
  /**
   * Visual style of the button.
   */
  variant?: "ghost" | "outline" | "solid";
  /**
   * Optional semantic tone. Currently only tweaks colors for danger cases.
   */
  tone?: "default" | "danger";
  /**
   * Whether to render using dark theme colors.
   */
  isDark?: boolean;
  className?: string;
  type?: "button" | "submit";
};

export function IconButton({
  children,
  onClick,
  disabled,
  size = "md",
  variant = "ghost",
  tone = "default",
  isDark,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const baseSize =
    size === "sm"
      ? "h-9 w-9 rounded-lg"
      : "h-10 w-10 rounded-lg";

  const palette =
    tone === "danger"
      ? isDark
        ? {
            ghost: "border-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200",
            outline:
              "border-red-500/60 text-red-200 hover:bg-red-500/10 hover:border-red-400",
            solid:
              "border-transparent bg-red-500 text-white hover:bg-red-400",
          }
        : {
            ghost:
              "border-transparent text-red-600 hover:bg-red-50 hover:text-red-700",
            outline:
              "border-red-400 text-red-700 hover:bg-red-50 hover:border-red-500",
            solid:
              "border-transparent bg-red-500 text-white hover:bg-red-600",
          }
      : isDark
      ? {
          ghost:
            "border-transparent text-white hover:bg-white/5",
          outline:
            "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10",
          solid:
            "border-transparent bg-white/10 text-white hover:bg-white/20",
        }
      : {
          ghost:
            "border-transparent text-slate-800 hover:bg-zinc-100",
          outline:
            "border-zinc-200 bg-white text-slate-800 hover:border-zinc-300 hover:bg-zinc-100",
          solid:
            "border-transparent bg-zinc-900 text-white hover:bg-zinc-800",
        };

  const variantClasses = palette[variant];

  const classes = [
    "flex items-center justify-center border transition cursor-pointer disabled:cursor-not-allowed",
    baseSize,
    variantClasses,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
}
