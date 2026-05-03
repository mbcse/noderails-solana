import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    />
  );
}

export function CardSection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardDivider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-line", className)} {...props} />;
}
