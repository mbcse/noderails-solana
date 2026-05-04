import type { ReactNode } from "react";
import { cn } from "./cn";

export function Stat({
  label,
  value,
  delta,
  trend = "up",
  icon,
  className
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium tracking-tight text-ink-muted">{label}</p>
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-canvas-muted text-ink-muted">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[26px] font-semibold tracking-tight text-ink">{value}</p>
      {delta ? (
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium",
            trend === "up" && "text-emerald-600",
            trend === "down" && "text-red-600",
            trend === "flat" && "text-ink-subtle"
          )}
        >
          <span>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {delta}
          </span>
          <span className="text-ink-subtle font-normal">vs last 7d</span>
        </p>
      ) : null}
    </div>
  );
}
