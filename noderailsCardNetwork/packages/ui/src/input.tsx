"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type UiInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Input({
  className,
  label,
  hint,
  leading,
  trailing,
  id,
  ...props
}: UiInputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="block w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[13px] font-medium text-ink"
        >
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          "group flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 shadow-sm",
          "transition-[box-shadow,border-color] duration-150",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15"
        )}
      >
        {leading ? <span className="text-ink-subtle">{leading}</span> : null}
        <input
          id={inputId}
          className={cn(
            "h-full w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle/70",
            className
          )}
          {...props}
        />
        {trailing ? <span className="text-ink-subtle">{trailing}</span> : null}
      </div>
      {hint ? <p className="mt-1.5 text-[12px] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
