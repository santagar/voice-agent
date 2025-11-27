"use client";

import React from "react";

type PillButtonProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function PillButton({
  children,
  className = "",
  onClick,
}: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium ${className}`}
    >
      {children}
    </button>
  );
}

