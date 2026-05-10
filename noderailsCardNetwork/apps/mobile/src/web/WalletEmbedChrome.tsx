import type { ReactNode } from "react";

/** Shared chrome for `/auth` and `/sign` on Expo web (SDK iframe / popup targets). */
export function WalletEmbedChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas-subtle font-sans text-ink antialiased">
      <div className="wallet-bg-decor pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute -left-32 top-0 h-[360px] w-[360px] rounded-full bg-indigo-100/60 blur-[100px]" />
        <div className="absolute -right-24 bottom-0 h-[300px] w-[300px] rounded-full bg-violet-100/50 blur-[100px]" />
      </div>
      <div className="wallet-shell relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-4 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
