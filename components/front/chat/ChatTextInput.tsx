"use client";

import React, { forwardRef } from "react";

type ChatTextInputProps = {
  isDark: boolean;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  disabled?: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export const ChatTextInput = forwardRef<HTMLInputElement, ChatTextInputProps>(
  function ChatTextInput(
    { isDark, value, onChange, placeholder, disabled, onKeyDown },
    ref
  ) {
    return (
      <input
        type="text"
        ref={ref}
        className={`h-14 w-full rounded-full border pl-5 pr-16 text-base placeholder:text-neutral-400 focus:outline-none shadow-sm ${
          isDark
            ? "border-white/10 bg-white/5 text-slate-100 shadow-black/30"
            : "border-zinc-300 bg-white/80 text-slate-900 shadow-black/10"
        }`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
    );
  }
);

