"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "success";
type Size = "sm" | "md" | "lg";

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-6 text-[15px] gap-2"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-medium tracking-tight whitespace-nowrap",
        "transition-[background,box-shadow,color,border-color,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        sizeStyles[size],
        variant === "primary" &&
          "bg-inverse-fill text-inverse-fg shadow-sm hover:opacity-90 active:scale-[0.98] focus-visible:ring-inverse-fill/40",
        variant === "secondary" &&
          "bg-brand text-white shadow-[var(--shadow-glow)] hover:bg-brand-hover active:scale-[0.98] focus-visible:ring-brand/40",
        variant === "outline" &&
          "border border-line bg-surface text-ink shadow-sm hover:bg-canvas-muted hover:border-line-strong focus-visible:ring-line-strong",
        variant === "ghost" &&
          "bg-transparent text-ink-muted hover:bg-canvas-muted hover:text-ink focus-visible:ring-line-strong",
        variant === "success" &&
          "bg-success text-white shadow-sm hover:bg-success/90 active:scale-[0.98] focus-visible:ring-success/40",
        className
      )}
      {...props}
    />
  );
}
