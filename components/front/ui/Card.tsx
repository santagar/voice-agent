"use client";

import React from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-lg backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

