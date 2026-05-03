import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "violet";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-canvas-muted text-ink-muted border-line",
  brand: "bg-brand-soft text-brand-ink border-brand/15",
  success: "bg-success-soft text-emerald-700 border-emerald-200",
  warning: "bg-warning-soft text-amber-700 border-amber-200",
  danger: "bg-danger-soft text-red-700 border-red-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200"
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium tracking-tight",
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
