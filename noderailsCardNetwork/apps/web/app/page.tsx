import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Code2, CreditCard, Gauge, Server, ShieldCheck, Smartphone, Sparkles, Wallet, Zap, Lock, Globe } from "lucide-react";
import { Badge, Button, Card, WallCardLogo } from "@noderails-card/ui";
import { HeroAnimatedCard } from "./components/hero-animated-card";
import { HeroSigningDemo } from "./components/hero-signing-demo";

/** App Store / Play / TestFlight — native install link for WallCard (marketing only). */
const mobileAppUrl = process.env.NEXT_PUBLIC_MOBILE_APP_URL?.trim() ?? "";
/** Hosted Expo web export (static `expo export --platform web`). Landing “Web app” CTA. */
const wallcardWebAppUrl = process.env.NEXT_PUBLIC_WALLCARD_WEB_APP_URL?.trim() ?? "";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Network", href: "#noderails-network" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Demo", href: "#interactive-demo" },
  { label: "SDK playground", href: "/examples" },
  { label: "Pricing", href: "#pricing" },
];

const features = [
  {
    icon: CreditCard,
    title: "Card-first checkout",
    body: "Card number, CVV, PIN, OTP: the same steps customers already know. No wallet extension, no seed phrase.",
    size: "md:col-span-2",
  },
  {
    icon: Wallet,
    title: "Solana + EVM signing",
    body: "solana_signMessage alongside personal_sign, eth_signTypedData_v4, and eth_sendTransaction, all via provider.request.",
    size: "md:col-span-1",
  },
  {
    icon: Server,
    title: "Strict API surface",
    body: "Idempotency keys, typed payloads, allowlisted origins, and deterministic HTTP responses.",
    size: "md:col-span-1",
  },
  {
    icon: Gauge,
    title: "Fast approvals",
    body: "Sub-400ms median confirmation. Clear auth states, no wallet popup roulette.",
    size: "md:col-span-2",
  },
];

const steps = [
  { n: "01", title: "Customer enters card details", body: "Card number, CVV, PIN, and OTP: familiar to anyone who has shopped online." },
  { n: "02", title: "Your app calls provider.request", body: "Same EIP-1193 interface as ethers v6 BrowserProvider or Solana wallet adapters." },
  { n: "03", title: "WallCard signs server-side", body: "Keys never leave the secure signer. Signature returned to your app in milliseconds." },
];

export default function Page() {
  return (
    <div className="relative overflow-hidden bg-canvas text-ink">
      {/* Nav */}
      <header className="nrc-crystal-nav sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <WallCardLogo size={32} className="block h-8 w-auto shrink-0 drop-shadow-sm" />
            <div className="leading-tight">
              <p className="text-[14px] font-bold tracking-tight text-ink">WallCard</p>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-subtle">
                <Image src="/noderails-network-icon.png" alt="" width={14} height={14} className="rounded-[4px] opacity-95" />
                by NodeRails
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((item) => (
              <a key={item.label} href={item.href} className="text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {wallcardWebAppUrl ? (
              <Button variant="outline" size="sm" className="inline-flex gap-1.5" asChild>
                <a href={wallcardWebAppUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden min-[380px]:inline">Web app</span>
                  <span className="min-[380px]:hidden">Web</span>
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 opacity-60"
                disabled
                title="Set NEXT_PUBLIC_WALLCARD_WEB_APP_URL (hosted Expo web build URL)."
              >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Web app</span>
              </Button>
            )}
            {mobileAppUrl ? (
              <Button variant="outline" size="sm" className="inline-flex gap-1.5" asChild>
                <a href={mobileAppUrl} target="_blank" rel="noopener noreferrer">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden min-[380px]:inline">Get mobile app</span>
                  <span className="min-[380px]:hidden">App</span>
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 opacity-60" disabled title="Set NEXT_PUBLIC_MOBILE_APP_URL in .env (store or install link).">
                <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Get mobile app</span>
              </Button>
            )}
            <Button size="sm" asChild>
              <a href="#interactive-demo">
                Try demo
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="product" className="relative border-b border-line">
        <div className="nrc-hero-mesh" aria-hidden />
        <div className="nrc-dot-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:px-8 lg:px-12 lg:pb-32 lg:pt-28">
          <div className="mx-auto grid max-w-3xl items-center gap-14 lg:max-w-none lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:text-left">
            <div className="text-center lg:text-left">
              <Badge tone="brand" className="mb-6 inline-flex">
                <Zap className="h-3 w-3" />
                Solana + EVM · card checkout · no extension
              </Badge>
              <h1 className="text-5xl font-black tracking-tighter text-ink sm:text-6xl lg:text-7xl">
                Pay with a card.{" "}
                <span className="nrc-gradient-text">Sign like a wallet.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted lg:mx-0">
                WallCard replaces wallet extension popups with a familiar card flow: card number, CVV, PIN, OTP. Same{" "}
                <span className="font-mono text-[15px] text-ink">provider.request</span> surface for Solana message signing and Ethereum typed data and sends.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Button size="lg" asChild>
                  <a href="#interactive-demo">
                    Open live demo
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                {wallcardWebAppUrl ? (
                  <Button size="lg" variant="outline" asChild>
                    <a href={wallcardWebAppUrl} target="_blank" rel="noopener noreferrer">
                      Open web app
                      <Globe className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" disabled title="Set NEXT_PUBLIC_WALLCARD_WEB_APP_URL to your hosted Expo web export.">
                    Open web app
                    <Globe className="h-4 w-4" />
                  </Button>
                )}
                {mobileAppUrl ? (
                  <Button size="lg" variant="outline" asChild>
                    <a href={mobileAppUrl} target="_blank" rel="noopener noreferrer">
                      Get mobile app
                      <Smartphone className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" disabled title="Add NEXT_PUBLIC_MOBILE_APP_URL to your env with your App Store / Play link.">
                    Get mobile app
                    <Smartphone className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[13px] text-ink-subtle lg:justify-start">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" /> PIN + OTP on every auth</span>
                <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-brand" /> Keys never leave the signer</span>
                <span className="flex items-center gap-1.5"><Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Solana + Ethereum</span>
              </div>
            </div>
            <HeroAnimatedCard />
          </div>
        </div>
      </section>

      {/* NodeRails Network — light surface, matches site chrome */}
      <section id="noderails-network" className="relative border-b border-line bg-canvas py-16 sm:py-24 lg:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-[18%] top-[-10%] h-[280px] w-[min(520px,70vw)] rounded-full bg-indigo-500/[0.06] blur-[100px]" />
          <div className="absolute -right-[12%] bottom-[-15%] h-[260px] w-[min(480px,65vw)] rounded-full bg-emerald-500/[0.05] blur-[95px]" />
        </div>

        <div className="relative mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-16">
          <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[var(--shadow-card-lg)] sm:rounded-[2.25rem]">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5] bg-[radial-gradient(rgb(99_102_241/0.055)_1px,transparent_1px)] bg-[size:22px_22px]"
              aria-hidden
            />

            <div className="relative px-5 py-11 sm:px-8 sm:py-12 lg:px-11 lg:py-14 xl:px-14 xl:py-16">
              {/* SDK playground */}
              <div className="mb-12 flex flex-col gap-5 border-b border-line bg-gradient-to-r from-brand-soft/[0.35] via-transparent to-emerald-500/[0.06] pb-10 sm:mb-14 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:rounded-2xl sm:border sm:border-line sm:bg-canvas-subtle/80 sm:p-6 sm:pb-6">
                <div className="flex items-start gap-4 sm:items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft ring-1 ring-brand/10">
                    <Code2 className="h-6 w-6 text-brand" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold tracking-tight text-ink">Test against production-shaped flows</p>
                    <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink-muted">
                      The SDK playground runs the real iframe wallet path: call{" "}
                      <span className="font-mono text-[12px] text-ink">provider.request</span> for Solana and EVM, watch the WallCard sheet, and inspect signatures and logs in one place.
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="lg" className="w-full shrink-0 sm:w-auto" asChild>
                  <Link href="/examples">
                    SDK playground
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
                {/* Logo */}
                <div className="relative flex shrink-0 flex-col items-center lg:items-start">
                  <div className="relative">
                    <div
                      className="pointer-events-none absolute -inset-6 rounded-[32px] bg-blue-500/[0.12] blur-2xl sm:-inset-8"
                      aria-hidden
                    />
                    <Image
                      src="/noderails-network-icon.png"
                      alt="NodeRails Network"
                      width={176}
                      height={176}
                      className="relative h-36 w-36 rounded-[26px] shadow-[var(--shadow-card-lg)] ring-1 ring-black/[0.06] sm:h-40 sm:w-40 sm:rounded-[28px] lg:h-44 lg:w-44"
                      priority={false}
                    />
                  </div>
                </div>

                {/* Narrative */}
                <div className="max-w-3xl flex-1 text-center lg:pt-2 lg:text-left">
                  <Badge tone="brand" className="border-brand/15 bg-brand-soft/80">
                    Blockchain payment network
                  </Badge>

                  <h2 className="mt-6 text-balance">
                    <span className="nrc-gradient-text block text-[clamp(2.25rem,5.5vw,3.75rem)] font-black leading-[0.95] tracking-[-0.04em]">
                      NodeRails Network
                    </span>
                    <span className="mt-4 block text-[1.125rem] font-semibold leading-snug tracking-tight text-ink sm:text-[1.35rem] lg:text-[1.4rem]">
                      The acceptance layer when commerce settles on-chain—not inside yesterday&apos;s bank batch window.
                    </span>
                  </h2>

                  <p className="mt-7 text-[16px] leading-[1.65] text-ink-muted sm:text-[17px]">
                    Visa and Mastercard exist to align issuers, merchants, and billions of cards across rails that were built for closed ledgers and overnight files.{" "}
                    <span className="font-semibold text-ink">NodeRails Network</span> carries that same{" "}
                    <span className="font-semibold text-ink">network responsibility</span>
                    {" "}for programmable money: shared policies, deterministic HTTPS APIs, and signatures that post to{" "}
                    <span className="font-mono text-[14px] text-ink">Solana</span> and{" "}
                    <span className="font-mono text-[14px] text-ink">EVM</span> infrastructure your product already uses.
                  </p>
                  <p className="mt-5 text-[15px] leading-relaxed text-ink-muted">
                    <span className="font-semibold text-ink">WallCard</span> is what people tap and trust at checkout.{" "}
                    <span className="font-semibold text-ink">NodeRails Network</span> is the fabric behind it: routing authorization, enforcing step-up, and turning approvals into on-chain outcomes without rebuilding your story around legacy correspondent banking.
                  </p>
                </div>
              </div>

              {/* Network guarantees */}
              <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
                {[
                  {
                    title: "Network economics, not branch banking",
                    body: "Position NodeRails like interchange and acceptance: routing value between participants, not holding retail deposits.",
                  },
                  {
                    title: "Finality where your chains live",
                    body: "Configure Solana and EVM rails so balances, signatures, and proofs line up with how your treasury actually moves.",
                  },
                  {
                    title: "Step-up shoppers already understand",
                    body: "PAN, CVV, PIN, OTP deliver serious authentication without turning every purchase into “install another wallet.”",
                  },
                  {
                    title: "SDKs your engineers recognize",
                    body: "REST where you need ops, WallCard SDK + EIP-1193 where you need signing parity with mainstream wallet tooling.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-line bg-canvas-subtle/70 p-5 transition-all hover:border-brand/25 hover:bg-canvas-subtle hover:shadow-[var(--shadow-card)]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/35">
                      <CheckCircle2 className="h-6 w-6 stroke-[2.5]" aria-hidden />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[15px] font-semibold tracking-tight text-ink">{item.title}</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mx-auto mt-10 max-w-3xl text-center text-[13px] leading-relaxed text-ink-muted sm:text-[13.5px]">
                <span className="font-semibold text-ink">Yesterday:</span> plastic networks, correspondent banks, overnight batches.{" "}
                <span className="font-semibold text-ink">NodeRails Network:</span> programmable clearing on public chains with WallCard-grade UX at the edge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-line bg-canvas-subtle py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Three steps. No extensions.</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              The checkout flow your customers already understand, wired to the signing interface your app already calls.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                  <span className="font-mono text-[13px] font-bold text-brand">{s.n}</span>
                </div>
                <h3 className="text-[17px] font-bold tracking-tight text-ink">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section className="border-b border-line py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Platform</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Built for teams that ship.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {features.map((f) => (
              <Card
                key={f.title}
                className={`group border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--shadow-card-lg)] ${f.size}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft">
                  <f.icon className="h-4.5 w-4.5 text-brand" />
                </div>
                <h3 className="mt-4 text-[17px] font-bold tracking-tight text-ink">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive demo */}
      <section id="interactive-demo" className="border-b border-line bg-canvas-subtle py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <Badge tone="brand" className="mb-3">
              <Sparkles className="h-3 w-3" />
              Live interactive demo
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">See it in action</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">
              Pick a signing method, click Run, and the card checkout flow opens. No wallet extension needed.
            </p>
          </div>
          <HeroSigningDemo />
        </div>
      </section>

      {/* CTA / waitlist */}
      <section id="pricing" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-2xl border border-line bg-canvas-subtle shadow-[var(--shadow-card)]">
            <div className="grid gap-8 p-8 sm:p-10 md:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <Badge tone="brand" className="mb-4">Launch access</Badge>
                <h3 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Join WallCard early operators</h3>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">
                  14,092 developers on waitlist. Zero account fee during launch window.
                </p>
              </div>
              <form className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-4 text-sm text-ink placeholder:text-ink-subtle outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.99]"
                >
                  Request access
                  <ChevronRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-[13px] text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <span>© {new Date().getFullYear()} NodeRails WallCard</span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" />
            Card-first UX. Power paths for developers.
          </span>
        </div>
      </footer>
    </div>
  );
}
