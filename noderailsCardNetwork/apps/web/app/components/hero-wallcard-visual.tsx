import Image from "next/image";

/** Hero artwork: NodeRails WallCard product shot (BTC, ETH, SOL). */
export function HeroWallCardVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(100%,420px)] w-[min(130%,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-orange-500/40 via-orange-300/15 to-transparent blur-[64px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-4 right-0 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl lg:right-8"
        aria-hidden
      />

      <div className="relative nrc-hero-card-float">
        <div className="relative rounded-[2rem] bg-gradient-to-br from-orange-300/35 via-orange-500/30 to-zinc-900/45 p-[1px] shadow-[0_28px_56px_-16px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,140,64,0.18)_inset]">
          <div className="overflow-hidden rounded-[1.9375rem] bg-zinc-950 ring-1 ring-white/10">
            <Image
              src="/hero-wallcard.png"
              alt="NodeRails WallCard Wallet Card with Bitcoin, Ethereum, and Solana"
              width={1024}
              height={682}
              className="h-auto w-full object-cover object-center"
              priority
              sizes="(max-width: 1024px) 100vw, 52vw"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
               <span className="rounded-full border border-line bg-surface/95 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted shadow-sm backdrop-blur-sm">
                  BTC, ETH, SOL
                </span>
                <span className="rounded-full border border-line bg-surface/95 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted shadow-sm backdrop-blur-sm">
                  Wallet Card
                </span>
        </div>
      </div>
    </div>
  );
}
