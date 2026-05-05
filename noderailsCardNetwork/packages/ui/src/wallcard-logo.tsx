/** Encoded SVG for CSS mask (avoids defs/#id hooks that break if two reacts ship in prod). */
const W_MASK_ENCODED = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="black" d="M4 6 L11 32 L20 14 L29 32 L36 6 L30 6 L25.5 22 L20 10 L14.5 22 L10 6 Z"/></svg>'
);

/** WallCard “W” — gradient via CSS mask so no SVG id / React hooks. */
export function WallCardLogo({
  size = 32,
  className,
  title
}: {
  size?: number;
  className?: string;
  /** When set (standalone), exposes accessible name. */
  title?: string;
}) {
  const mask = `url("data:image/svg+xml,${W_MASK_ENCODED}") no-repeat center / contain`;

  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-block",
        verticalAlign: "middle",
        background: "linear-gradient(135deg, #a78bfa 0%, #ff2e93 55%, #ff6b35 100%)",
        WebkitMask: mask,
        mask: mask
      }}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
