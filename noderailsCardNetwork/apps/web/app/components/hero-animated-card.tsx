"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/** Hero marketing card: uses branded reference artwork (`/wallcard-hero-reference.png`) as the exact visual. */
export function HeroAnimatedCard() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] lg:mx-0 lg:max-w-[460px]">
      <div
        className="pointer-events-none absolute -left-10 top-1/3 h-80 w-80 -translate-y-1/2 rounded-full bg-[#FF6BC8]/25 blur-[88px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 bottom-1/4 h-72 w-72 rounded-full bg-[#a855f7]/20 blur-[72px]"
        aria-hidden
      />

      <motion.div
        className="relative nrc-hero-card-float"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-[8%] -z-10 rounded-[28px] blur-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgb(255 46 147 / 0.45), rgb(124 58 237 / 0.35), rgb(255 107 53 / 0.4))",
            }}
            aria-hidden
          />

          <div className="relative overflow-hidden rounded-[22px] shadow-[0_28px_72px_-28px_rgb(168_85_247/0.55),0_18px_48px_-20px_rgb(255_46_147/0.35)] ring-1 ring-white/15">
            <Image
              src="/wallcard-hero-reference.png"
              alt="WallCard virtual debit card: Wallet and Debit, on-chain wallet, NodeRails network"
              width={1024}
              height={599}
              sizes="(max-width: 1024px) min(92vw, 420px), 460px"
              className="h-auto w-full select-none"
              priority
              draggable={false}
            />
          </div>

          <motion.div
            className="pointer-events-none absolute -bottom-6 left-1/2 h-20 w-[88%] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                "linear-gradient(90deg, rgb(168 85 247 / 0.35), rgb(255 46 147 / 0.38), rgb(255 107 53 / 0.35))",
            }}
            animate={{ opacity: [0.55, 0.9, 0.55] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-400/25 dark:text-emerald-50 dark:ring-emerald-400/20">
            SOL · provider.request
          </span>
          <span className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-800 ring-1 ring-indigo-400/25 dark:text-indigo-50 dark:ring-indigo-400/20">
            ETH · typed data & sends
          </span>
        </div>
      </motion.div>
    </div>
  );
}
