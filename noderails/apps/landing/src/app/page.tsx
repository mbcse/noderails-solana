import { NodeRailsLogo } from '@/components/noderails-logo';
import { TrackedLink } from '@/components/tracked-link';
import { HeroPreviewSwitcher } from '@/components/hero-preview-switcher';
import { FeedbackWidget } from '@/components/feedback-widget';
import Image from 'next/image';
import {
  ArrowRight,
  CreditCard,
  ArrowLeftRight,
  Coins,
  Shield,
  Check,
  ChevronRight,
  Wallet,
  Fingerprint,
  Globe2,
} from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001';
const WALLCARD_URL = 'https://wallcard.noderails.com/';
const X_URL = 'https://x.com/noderails';
const LINKEDIN_URL = 'https://www.linkedin.com/company/noderails';
const TELEGRAM_URL = 'https://t.me/+fzUTcAYr-zhhZjg1';
const DISCORD_URL = 'https://discord.gg/8uwSfv9Tvk';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* ── Navigation ── */}
      <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <NodeRailsLogo withText className="w-[220px] h-auto" />
            </div>

            <div className="hidden md:flex space-x-8">
              <a href="#products" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Products</a>
              <a href="#wallcard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">WallCard</a>
              <a href="#developers" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Developers</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
              <a href="/docs" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Docs</a>
            </div>

            <div className="flex items-center gap-4">
              <TrackedLink
                href={`${DASHBOARD_URL}/login`}
                event="landing_login_clicked"
                properties={{ location: 'nav' }}
                className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Merchant Login
                <ChevronRight className="h-4 w-4 ml-1" />
              </TrackedLink>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="hero-mesh" />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
          <div className="lg:grid lg:grid-cols-5 lg:gap-16 items-center">
            {/* Left - Copy */}
            <div className="mb-12 lg:mb-0 lg:col-span-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wide mb-6">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Live on multiple blockchains
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8">
                The first ever comprehensive{' '}
                <span className="gradient-text">Crypto Payment Infrastructure</span>
                   <span className="bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 bg-clip-text text-transparent"> & Gateway</span>
              </h1>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
                Accept crypto payments with hosted checkout, payment links, subscriptions, and invoices. Built-in fraud risk engine and compliance checks run in the background, so you and your users do not have to worry. Built-in chargebacks and refunds. Designed for developers and businesses from day one.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <TrackedLink
                  href={`${DASHBOARD_URL}/login`}
                  event="landing_signup_clicked"
                  properties={{ location: 'hero_primary' }}
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Start now
                  <ArrowRight className="h-5 w-5 ml-2" />
                </TrackedLink>
                <TrackedLink
                  href="mailto:business@noderails.com"
                  event="landing_contact_sales_clicked"
                  properties={{ location: 'hero_secondary' }}
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                >
                  Contact sales
                </TrackedLink>
              </div>
            </div>

            {/* Right - Dashboard Preview */}
            <div className="relative lg:col-span-3">
              {/* Product Hunt badge */}
              <div className="flex justify-end mb-4 relative z-10">
                <a
                  href="https://www.producthunt.com/products/noderails?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-noderails"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="NodeRails on Product Hunt"
                  className="block"
                >
                  <img
                    alt="NodeRails - Comprehensive Crypto Payments Infrastructure and Gateway | Product Hunt"
                    width={250}
                    height={54}
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1115116&theme=light&t=1775311850928"
                  />
                </a>
              </div>
              {/* Blob decorations */}
              <div className="absolute -top-12 -right-12 w-72 h-60 bg-purple-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob" />
              <div className="absolute -bottom-12 -left-12 w-72 h-60 bg-indigo-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000" />

              <HeroPreviewSwitcher />
            </div>
          </div>
        </div>
      </main>

      {/* ── Interactive Demo ── */}
      <section id="interactive-demo" className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <h2 className="text-indigo-600 font-semibold tracking-wide uppercase text-sm mb-3">Interactive Demo</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">See NodeRails in action</h3>
            <p className="text-lg text-slate-600 leading-relaxed">
              Explore the checkout and payment flow with a live interactive walkthrough.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)]">
            <div style={{ position: 'relative', paddingBottom: 'calc(56.1684% + 41px)', height: 0, width: '100%' }}>
              <iframe
                src="https://demo.arcade.software/fYpBogRqsEAUF1wU2vk2?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true"
                title="NodeRails Interactive Demo"
                frameBorder="0"
                loading="lazy"
                allow="clipboard-write"
                allowFullScreen
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  colorScheme: 'light',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trusted By ── */}
      {/* <section className="border-y border-slate-100 bg-slate-50/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-slate-500 mb-8">TRUSTED BY INNOVATIVE TEAMS WORLDWIDE</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex justify-center">
              <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><path d="M10,15 L20,5 L30,15 L20,25 Z M40,5 H90 V25 H40 Z" /></svg>
            </div>
            <div className="flex justify-center">
              <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><circle cx="15" cy="15" r="10" /><rect x="35" y="10" width="55" height="10" /></svg>
            </div>
            <div className="flex justify-center">
              <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><path d="M10,5 L30,5 L20,25 Z M40,10 H90 V20 H40 Z" /></svg>
            </div>
            <div className="flex justify-center">
              <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><rect x="10" y="5" width="20" height="20" rx="5" /><rect x="40" y="10" width="50" height="10" /></svg>
            </div>
            <div className="flex justify-center">
              <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><path d="M10,25 L20,5 L30,25 M40,10 H90 V20 H40 Z" stroke="currentColor" strokeWidth="4" /></svg>
            </div>
            <div className="flex justify-center">
              <svg className="h-8" viewBox="0 0 100 30" fill="currentColor"><circle cx="15" cy="15" r="8" /><circle cx="25" cy="15" r="8" /><rect x="45" y="10" width="45" height="10" /></svg>
            </div>
          </div>
        </div>
      </section> */}

      {/* ── Unified Platform ── */}
      <section id="products" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white to-slate-50 -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <h2 className="text-indigo-600 font-semibold tracking-wide uppercase text-sm mb-3">Complete Payment Stack</h2>
            <h3 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">Everything you need to accept crypto, with real buyer protection</h3>
            <p className="text-xl text-slate-600">
              Payment links, hosted checkout, chargebacks, refunds, subscriptions, and invoicing, all settled directly to your wallet. No middlemen. One API.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ProductCard
              icon={CreditCard}
              title="Payments & Checkout"
              description="Accept crypto via hosted checkout pages or embeddable payment links. Funds settle directly to your wallet. Zero middlemen."
              color="blue"
            />
            <ProductCard
              icon={Shield}
              title="Chargebacks & Refunds"
              description="Built-in chargeback and refund flow with on-chain dispute resolution. Real buyer protection for crypto commerce."
              color="indigo"
            />
            <ProductCard
              icon={ArrowLeftRight}
              title="Payment Links"
              description="Generate shareable payment links for any amount. Share via email, chat, or embed on your site. One click to pay."
              color="purple"
            />
            <ProductCard
              icon={Coins}
              title="Subscriptions & Invoices"
              description="Recurring billing with automatic charge cycles. Create invoices with payment links and track status in real-time."
              color="pink"
            />
          </div>
        </div>
      </section>

      {/* ── Risk & Compliance Section ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.08),transparent_40%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <h2 className="text-indigo-600 font-semibold tracking-wide uppercase text-sm mb-3">Built-In Safety Layer</h2>
              <h3 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">Inbuilt fraud risk engine and compliance checks</h3>
              <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
                NodeRails continuously runs fraud scoring, wallet risk detection, sanctions screening, and compliance checks in the background. Your team and your users can focus on payments while risk controls run automatically.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Shield className="h-5 w-5 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">Auto risk scoring</p>
                    <p className="text-sm text-slate-600">Every payment is evaluated in real time for suspicious behavior and anomalous patterns.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">Compliance by default</p>
                    <p className="text-sm text-slate-600">Built-in checks and audit-ready traces reduce manual ops for both merchants and finance teams.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative lg:scale-105 origin-center">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)] p-2">
                <img
                  src="/screenshots/payment-details.png"
                  alt="NodeRails payment detail showing fee breakdown, tax, and risk checks"
                  className="w-full h-auto rounded-2xl border border-slate-100"
                />
              </div>
              <div className="absolute -bottom-5 -left-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Risk Engine</p>
                <p className="text-sm text-emerald-900 font-medium">Monitoring active</p>
              </div>
              <div className="absolute -top-5 -right-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">Compliance</p>
                <p className="text-sm text-indigo-900 font-medium">Checks running</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WallCard / NodeRails Network ── */}
      <section
        id="wallcard"
        className="py-24 relative overflow-hidden border-y border-pink-100 bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 text-slate-900"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(244,114,182,0.2),transparent_50%),radial-gradient(circle_at_90%_75%,rgba(167,139,250,0.12),transparent_45%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-16 items-start lg:items-center">
            <div className="lg:col-span-7 min-w-0">
              <div className="max-w-3xl mb-12">
                <p className="text-rose-600 font-semibold tracking-wide uppercase text-sm mb-3">NodeRails Network</p>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900">
                  WallCard: pay with a card,{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">
                    sign like a wallet
                  </span>
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-4">
                  <strong className="text-slate-900 font-semibold">NodeRails Network</strong> is the on-chain acceptance layer for programmable money: shared policies, HTTPS APIs, and signatures that settle on Solana and EVM.{' '}
                  <strong className="text-slate-900 font-semibold">WallCard</strong> is the wallet shoppers see at checkout (card number, CVV, PIN, and OTP) instead of another browser extension.
                </p>
                <p className="text-lg text-slate-600 leading-relaxed">
                  Your app keeps calling the same{' '}
                  <code className="text-sm px-1.5 py-0.5 rounded-md bg-white/90 border border-pink-100 text-indigo-700 font-mono shadow-sm">
                    provider.request
                  </code>{' '}
                  surface for Solana message signing and Ethereum typed data and sends. WallCard handles the card flow and secure signer so keys never leave the secure environment.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 lg:mb-12 items-stretch">
                <div className="rounded-2xl border border-pink-100/80 bg-white/80 shadow-sm backdrop-blur-sm p-6 flex flex-col h-full min-h-0">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4 shrink-0">
                    <CreditCard className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">Card-first checkout</h3>
                  <p className="text-sm text-slate-600 leading-relaxed grow">
                    Familiar PAN, CVV, PIN, and OTP steps. No seed phrase, and no “install another wallet” for every purchase.
                  </p>
                </div>
                <div className="rounded-2xl border border-pink-100/80 bg-white/80 shadow-sm backdrop-blur-sm p-6 flex flex-col h-full min-h-0">
                  <div className="w-11 h-11 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center mb-4 shrink-0">
                    <Wallet className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">Solana + Ethereum</h3>
                  <p className="text-sm text-slate-600 leading-relaxed grow">
                    Same EIP-1193-style flow as mainstream wallet tooling: message signing, typed data, and sends on Solana and EVM.
                  </p>
                </div>
                <div className="rounded-2xl border border-pink-100/80 bg-white/80 shadow-sm backdrop-blur-sm p-6 flex flex-col h-full min-h-0">
                  <div className="w-11 h-11 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center mb-4 shrink-0">
                    <Globe2 className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">Network, not a bank branch</h3>
                  <p className="text-sm text-slate-600 leading-relaxed grow">
                    Visa- and Mastercard-style routing for programmable money, with interchange-style economics on the chains you already use.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-stretch sm:items-start gap-4">
                <TrackedLink
                  href={WALLCARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  event="landing_wallcard_cta_clicked"
                  properties={{ location: 'wallcard_section_primary' }}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-10 py-5 text-lg font-semibold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/20 hover:-translate-y-0.5"
                >
                  <Fingerprint className="h-6 w-6 shrink-0 text-pink-100" aria-hidden />
                  Explore WallCard &amp; NodeRails Network
                  <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
                </TrackedLink>
                <p className="text-sm text-slate-600 max-w-xl">
                  Live demo, SDK playground, and product details on{' '}
                  <span className="text-slate-700 font-mono text-xs break-all sm:break-normal">wallcard.noderails.com</span>
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center lg:justify-end min-w-0 mt-14 lg:mt-0">
              <div className="relative w-full max-w-[320px] sm:max-w-sm md:max-w-md xl:max-w-[420px] shrink-0">
                <div
                  className="pointer-events-none absolute -inset-6 md:-inset-10 rounded-[2rem] bg-gradient-to-tr from-pink-300/35 via-rose-200/25 to-transparent blur-2xl"
                  aria-hidden
                />
                <Image
                  src="/marketing/wallcard-card.png"
                  alt="WallCard virtual debit card, wallet and debit on the NodeRails Network"
                  width={1024}
                  height={599}
                  className="relative w-full h-auto rounded-2xl shadow-[0_24px_60px_-12px_rgba(190,24,93,0.25)] ring-1 ring-pink-200/60"
                  sizes="(max-width: 1024px) 90vw, 420px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Developer Section ── */}
      <section id="developers" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-900/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-900/30 rounded-full filter blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-2 lg:gap-20 items-center">
            {/* Left - Copy */}
            <div className="mb-12 lg:mb-0">
              <h2 className="text-indigo-400 font-semibold tracking-wide uppercase text-sm mb-3">Built for Developers & Businesses</h2>
              <h3 className="text-4xl font-bold tracking-tight mb-6">Integrate crypto payments in minutes, not weeks</h3>
              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                A clean REST API, production-ready SDK, pre-built checkout components, and comprehensive webhooks. Get chargeback and refund support out of the box.
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-300">Any blockchain supported with one integration</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-300">Built-in chargebacks, refunds &amp; dispute resolution</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-300">Hosted checkout, payment links &amp; webhooks with HMAC</span>
                </li>
              </ul>

              <div className="flex gap-4">
                <a href="/docs" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-full font-medium transition-colors">
                  Read the docs
                </a>
                <a href="https://github.com/noderails" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-full font-medium transition-colors">
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Right - Code Block */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
              <div className="relative bg-slate-950 rounded-xl shadow-2xl overflow-hidden border border-slate-800">
                <div className="flex items-center px-4 py-3 bg-slate-900 border-b border-slate-800">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="ml-4 text-xs text-slate-500 font-mono">create-payment-checkout.ts</div>
                </div>
                <div className="p-6 overflow-x-auto">
                  <pre className="code-block text-sm text-slate-300 leading-relaxed">
<span className="text-purple-400">import</span> NodeRails <span className="text-purple-400">from</span> <span className="text-green-300">&apos;noderails-node&apos;</span>;{'\n'}
<span className="text-slate-500">// Initialize with your secret key</span>{'\n'}
<span className="text-purple-400">const</span> noderails <span className="text-purple-400">=</span> <span className="text-purple-400">new</span> <span className="text-blue-400">NodeRails</span>(<span className="text-green-300">&apos;sk_live_...&apos;</span>);{'\n'}
<span className="text-slate-500">// Create a hosted payment checkout session</span>{'\n'}
<span className="text-purple-400">const</span> checkout <span className="text-purple-400">=</span> <span className="text-purple-400">await</span> noderails.checkoutSessions.<span className="text-blue-400">create</span>({'{'}
{'  '}mode: <span className="text-green-300">&quot;payment&quot;</span>,
{'  '}amount: <span className="text-orange-400">&quot;49.99&quot;</span>,
{'  '}currency: <span className="text-green-300">&quot;USD&quot;</span>,
{'  '}successUrl: <span className="text-green-300">&quot;https://app.com/success&quot;</span>,
{'  '}cancelUrl: <span className="text-green-300">&quot;https://app.com/cancel&quot;</span>,
{'}'});{'\n'}
<span className="text-slate-500">// Redirect customer to hosted checkout URL</span>{'\n'}
console.<span className="text-blue-400">log</span>(checkout.checkoutUrl);{'\n'}
<span className="text-slate-500">// Handle webhooks automatically</span>{'\n'}
noderails.webhooks.<span className="text-blue-400">listen</span>(<span className="text-green-300">&apos;payment.captured&apos;</span>, (event) <span className="text-purple-400">=&gt;</span> {'{'}
{'  '}console.<span className="text-blue-400">log</span>(<span className="text-green-300">{`\`Checkout paid: \${event.id}\``}</span>);
{'}'});
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">Your wallet. Your payments. No middlemen.</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-16">
            NodeRails handles multi-chain payment routing, chargebacks, and refunds with a single integration for your business.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">Multi-Chain</div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Blockchain Support</div>
              <div className="mt-4 h-1 w-12 bg-indigo-500 mx-auto rounded-full" />
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">99.99%</div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Uptime SLA</div>
              <div className="mt-4 h-1 w-12 bg-purple-500 mx-auto rounded-full" />
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-900 mb-2">1%</div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">Per Transaction Fee</div>
              <div className="mt-4 h-1 w-12 bg-pink-500 mx-auto rounded-full" />
            </div>
          </div>

          {/* Platform Screenshot */}
          <div className="mt-20 relative mx-auto">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)] p-2">
              <img
                src="/screenshots/dashboard-overview.png"
                alt="NodeRails dashboard showing payment stats, networks, and wallet balances"
                className="w-full h-auto rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Agents Section ── */}

            {/* ── Built for Humans Section ── */}
            <section className="py-24 relative overflow-hidden bg-gradient-to-r from-blue-50 via-white to-purple-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-16">
                  <h2 className="text-indigo-600 font-semibold tracking-wide uppercase text-sm mb-3">For Merchants &amp; Businesses</h2>
                  <h3 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">Everything merchants need. Zero friction.</h3>
                  <p className="text-xl text-slate-600 max-w-2xl">
                    Create a complete payment experience for your customers with payment links, checkout sessions, subscriptions, and invoices, all powered by crypto and settled directly to your wallet.
                  </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Left - Feature Cards */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mr-4">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 mb-2">Payment Links</h4>
                          <p className="text-slate-600">Generate unique payment links to share via email, SMS, or chat. Customers can pay instantly with one click.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mr-4">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 mb-2">Hosted Checkout</h4>
                          <p className="text-slate-600">Branded, embeddable checkout pages. Manage payments, compliance, and customer data all in one place.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mr-4">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 mb-2">Subscriptions</h4>
                          <p className="text-slate-600">Build recurring revenue with automatic billing. Manage subscription cycles and customer lifecycle in real-time.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <div className="w-12 h-12 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center flex-shrink-0 mr-4">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900 mb-2">Invoices</h4>
                          <p className="text-slate-600">Create and send crypto invoices with payment links. Track payment status and get automatic reminders.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right - Real Platform Screenshot */}
                  <div className="relative lg:scale-105 origin-center">
                    <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 h-52 w-52 rounded-full bg-pink-200/40 blur-3xl" />

                    <div className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)] p-2">
                      <img
                        src="/screenshots/payments-list.png"
                        alt="NodeRails merchant dashboard showing payments, statuses, and filters"
                        className="w-full h-auto rounded-2xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-16 text-center">
                  <TrackedLink
                    href={`${DASHBOARD_URL}/login`}
                    event="landing_merchants_clicked"
                    properties={{ location: 'humans_section' }}
                    className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  >
                    Start Accepting Payments
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </TrackedLink>
                </div>
              </div>
            </section>
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-50 to-white -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left - Copy */}
            <div className="mb-12 lg:mb-0">
              <h2 className="text-indigo-600 font-semibold tracking-wide uppercase text-sm mb-3">Built for AI & Agents</h2>
              <h3 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">Agent-to-Agent Payments Made Simple</h3>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Launch agent crypto cards and create seamless payment layers for autonomous systems. Enable gasless agent-to-agent transactions with built-in settlement and dispute resolution.
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-indigo-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Gasless agent-to-agent payments</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-indigo-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Agent crypto card infrastructure</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-indigo-600 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">Automated dispute resolution</span>
                </li>
              </ul>

              <TrackedLink
                href={`${DASHBOARD_URL}/login`}
                event="landing_agents_clicked"
                properties={{ location: 'agents_section' }}
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Enable Agents
                <ArrowRight className="h-5 w-5 ml-2" />
              </TrackedLink>
            </div>

            {/* Right - Agent Crypto Card Banner */}
            <div className="relative pt-6">
              <div className="absolute -top-8 -right-8 h-48 w-48 rounded-full bg-indigo-300/30 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-52 w-52 rounded-full bg-purple-300/30 blur-3xl" />

              <div className="relative mx-auto max-w-xl">
                <div className="relative overflow-hidden rounded-[30px] border border-fuchsia-200/30 bg-[linear-gradient(135deg,#050816_0%,#20103f_34%,#093367_68%,#1d0e34_100%)] p-7 shadow-[0_24px_90px_rgba(76,29,149,0.45)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.22),transparent_40%),radial-gradient(circle_at_92%_88%,rgba(192,132,252,0.28),transparent_38%),radial-gradient(circle_at_75%_18%,rgba(56,189,248,0.2),transparent_36%)]" />
                  <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:24px_24px]" />
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-white/15 to-transparent" />
                  <div className="pointer-events-none absolute left-0 top-0 h-24 w-full bg-gradient-to-b from-cyan-200/20 to-transparent" />

                  <div className="relative z-10 flex items-start justify-between">
                    <div>
                      <div className="rounded-lg bg-white/90 p-1.5 w-fit">
                        <NodeRailsLogo className="h-6 w-6" />
                      </div>
                      <h4 className="mt-2 bg-gradient-to-r from-white via-cyan-100 to-fuchsia-100 bg-clip-text text-2xl font-bold text-transparent">Agent Crypto Card</h4>
                    </div>
                    <div className="rounded-full border border-emerald-300/40 bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                      Active
                    </div>
                  </div>

                  <div className="relative z-10 mt-8 flex items-center justify-between">
                    <div className="relative h-10 w-14 rounded-md bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500 shadow-inner">
                      <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-amber-600/50" />
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                      <NodeRailsLogo className="h-4 w-4" />
                      <span className="text-xs font-semibold text-white/90">NodeRails</span>
                    </div>
                  </div>

                  <p className="relative z-10 mt-7 font-mono text-xl tracking-[0.14em] text-white drop-shadow-[0_0_12px_rgba(147,197,253,0.45)]">4532 9856 1204 7719</p>

                  <div className="relative z-10 mt-6 grid grid-cols-3 gap-4 text-xs text-indigo-100/90">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-indigo-200/80">Card Holder</p>
                      <p className="mt-1 font-semibold text-white">AGENT PRIME</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-indigo-200/80">Network</p>
                      <p className="mt-1 font-semibold text-white">Multi-Chain</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-indigo-200/80">Expires</p>
                      <p className="mt-1 font-semibold text-white">12/29</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Card Type</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">Virtual Crypto</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Settlement</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">&lt; 30s</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Gas</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">Sponsored</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Payouts Section ── */}
      <section className="py-24 bg-gradient-to-r from-slate-900 to-slate-800 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-900/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-900/20 rounded-full filter blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mb-16">
            <h2 className="text-indigo-400 font-semibold tracking-wide uppercase text-sm mb-3">Fast & Reliable Payouts</h2>
            <h3 className="text-4xl font-bold tracking-tight mb-6">Multi-Chain, Multi-Recipient Payouts in Seconds</h3>
            <p className="text-xl text-slate-300">
              Send payments to thousands of recipients across multiple blockchains simultaneously. Perfect for rewards, bounties, referrals, and team payouts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-3">1000+</div>
              <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Recipients Per Batch</div>
              <p className="text-slate-400 text-sm">Pay unlimited recipients in a single transaction</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">&lt;30s</div>
              <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Settlement Time</div>
              <p className="text-slate-400 text-sm">Fast on-chain settlement with instant confirmation</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400 mb-3">Multi-Chain</div>
              <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Blockchain Compatible</div>
              <p className="text-slate-400 text-sm">Works across multiple blockchains and networks</p>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-12">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h4 className="text-xl font-bold mb-6">Perfect For:</h4>
                <ul className="space-y-3">
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Team payroll and salary distribution
                  </li>
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Bounty and reward programs
                  </li>
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Referral commissions and affiliate payouts
                  </li>
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Liquidity mining rewards and airdrops
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xl font-bold mb-6">Features:</h4>
                <ul className="space-y-3">
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    CSV batch file support for easy uploading
                  </li>
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Real-time payout status tracking
                  </li>
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Automatic retry on failed transactions
                  </li>
                  <li className="flex items-center text-slate-300">
                    <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                    Compliance and audit logs included
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <TrackedLink
              href={`${DASHBOARD_URL}/login`}
              event="landing_payouts_clicked"
              properties={{ location: 'payouts_section' }}
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full text-slate-900 bg-white hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Start Payouts
              <ArrowRight className="h-5 w-5 ml-2" />
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-lg text-slate-600 mb-12">Simple, transparent pricing with plans that scale as you grow.</p>

          <div className="grid gap-6 md:grid-cols-3 text-left">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="text-sm font-semibold text-indigo-600 mb-3">Introductory Offer</p>
              <p className="text-5xl font-extrabold text-slate-900">1%</p>
              <p className="mt-2 text-sm text-slate-500">per successful transaction</p>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-600" /> Hosted checkout and payment links</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-600" /> Refunds and chargebacks</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-600" /> Webhooks and dashboard analytics</li>
              </ul>
              <TrackedLink
                href={`${DASHBOARD_URL}/login`}
                event="landing_signup_clicked"
                properties={{ location: 'pricing_intro_card' }}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </TrackedLink>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-3">Normal Pricing</p>
              <p className="text-5xl font-extrabold text-slate-900">2%</p>
              <p className="mt-2 text-sm text-slate-500">per successful transaction</p>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-slate-700" /> Everything in Introductory</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-slate-700" /> Subscriptions and invoice workflows</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-slate-700" /> Priority support queue</li>
              </ul>
              <TrackedLink
                href={`${DASHBOARD_URL}/login`}
                event="landing_signup_clicked"
                properties={{ location: 'pricing_normal_card' }}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Choose Plan <ArrowRight className="h-4 w-4" />
              </TrackedLink>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="text-sm font-semibold text-amber-700 mb-3">Enterprise</p>
              <p className="text-3xl font-extrabold text-slate-900">Negotiate</p>
              <p className="mt-2 text-sm text-slate-500">custom pricing and support</p>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-700" /> Custom commercial terms</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-700" /> Dedicated onboarding and SLA</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-700" /> Architecture and migration support</li>
              </ul>
              <TrackedLink
                href="/docs"
                event="landing_docs_clicked"
                properties={{ location: 'pricing_enterprise_card' }}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Talk to Us <ArrowRight className="h-4 w-4" />
              </TrackedLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
            <p className="text-lg text-slate-600">Everything merchants and users ask us before going live.</p>
          </div>

          <div className="space-y-4">
            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 open:bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 flex items-center justify-between">
                Are you compliant?
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Yes, compliance and safety are core to how NodeRails is built. We are focused on delivering
                the true essence of blockchain: decentralization and control for both merchants and users.
                NodeRails is non-custodial and acts as a technology layer for payments, not a custody holder,
                so funds remain controlled by contract rules and wallet ownership. We run AML screening and
                fraud checks behind the scenes, and we make global payments much easier to start than the
                traditional multi-step setup flow merchants face with legacy gateways.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 open:bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 flex items-center justify-between">
                Are my funds safe?
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Yes. Funds are secured in NodeRails escrow smart contracts with timelocks enforced on-chain.
                Once a payment is <strong>captured</strong>, that means funds are locked for that payment flow and are
                intended for you as the merchant. They are 100% going to your wallet unless a user raises a dispute
                and wins. If no dispute is raised (or if merchant wins), funds settle automatically to your wallet.
                And even if our server is delayed for any reason, you can still call settle directly on the smart
                contract. We cannot stop valid settlement from reaching your wallet. Funds can only go to merchant
                or user, no other party.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 open:bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 flex items-center justify-between">
                Do subscriptions really work?
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Yes. Subscriptions work similar to fiat recurring billing: users are charged automatically on
                the configured schedule (monthly, yearly, or custom cycle). NodeRails handles recurring charge
                orchestration and lifecycle events so you can focus on your product, not billing operations.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 open:bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 flex items-center justify-between">
                How does the dispute mechanism work?
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                The lifecycle is: <strong>Authorize -&gt; Capture -&gt; Dispute -&gt; Settle</strong>.
                Capture means funds are secured for this payment and on the path to merchant settlement. Users get
                receipts with an "open dispute" link and can also raise disputes from the NodeRails dispute portal
                during the dispute window. If a user does not raise a dispute, settlement happens automatically to
                merchant wallet. If a dispute is raised, outcome decides merchant vs user. If user loses, funds settle
                to merchant. If user wins, funds return to user. Also, if auto-settlement is delayed for any reason,
                settlement can be triggered on-chain directly. We cannot block rightful settlement.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 open:bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 flex items-center justify-between">
                How do I get onboarded?
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Onboarding is fast. Sign up, create your account (individual or business), create your app,
                and start accepting payments. You can test safely on test networks before going to production.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-5 open:bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none text-lg font-semibold text-slate-900 flex items-center justify-between">
                The chain I need is not listed. What should I do?
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                We are actively adding more chains and network capabilities. If you need a specific chain prioritized,
                send us a request through the portal or message us on
                {' '}
                <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-700">Telegram</a>
                {' '}
                or
                {' '}
                <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-700">Discord</a>
                .
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600 skew-y-1 transform origin-bottom-right z-0" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to accept crypto payments?</h2>
          <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto">
            Start accepting payments directly to your wallet in minutes. No middlemen. Full chargeback and refund support built in.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TrackedLink
              href={`${DASHBOARD_URL}/login`}
              event="landing_signup_clicked"
              properties={{ location: 'final_cta_primary' }}
              className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold rounded-full text-indigo-700 bg-white hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Create account
            </TrackedLink>
            <TrackedLink
              href="/docs"
              event="landing_docs_clicked"
              properties={{ location: 'final_cta_secondary' }}
              className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold rounded-full text-white bg-indigo-500 hover:bg-indigo-400 transition-colors border border-indigo-400"
            >
              Read the docs
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-50 pt-16 pb-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center mb-4">
                <NodeRailsLogo withText className="w-[200px] h-auto" />
              </div>
              <p className="text-sm text-slate-500 mb-2">
                A product of Maartandrise International<br />Ventures Private Limited
              </p>
              <p className="text-xs text-slate-400 mb-4">
                &copy; {new Date().getFullYear()} All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a href={X_URL} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
                </a>
                <a href="https://github.com/noderails" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">GitHub</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                </a>
                <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 7.02c1.08 0 1.75-.71 1.75-1.6-.02-.91-.67-1.6-1.73-1.6-1.06 0-1.75.69-1.75 1.6 0 .89.67 1.6 1.71 1.6h.02ZM20.44 13.43c0-3.43-1.83-5.03-4.27-5.03-1.97 0-2.85 1.09-3.35 1.85v-1.59H9.44c.04 1.05 0 11.34 0 11.34h3.38v-6.34c0-.34.02-.67.12-.92.27-.67.88-1.36 1.9-1.36 1.34 0 1.88 1.03 1.88 2.55V20h3.38v-6.57Z"/></svg>
                </a>
                <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Telegram</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M21.47 4.35a1 1 0 0 0-1.06-.16L2.89 11.18a1 1 0 0 0 .09 1.88l4.27 1.36 1.6 5.08a1 1 0 0 0 1.71.36l2.38-2.44 4.66 3.43a1 1 0 0 0 1.58-.59l2.5-14.78a1 1 0 0 0-.21-.83ZM9.04 14.28l8.6-6.18-6.87 7.09-.44 2.43-1.29-3.34Z"/></svg>
                </a>
                <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Discord</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.32 4.37A18.2 18.2 0 0 0 15.78 3c-.2.36-.43.84-.59 1.22a16.9 16.9 0 0 0-5.38 0A12.7 12.7 0 0 0 9.22 3c-1.6.27-3.12.74-4.54 1.37C1.8 8.65 1.02 12.83 1.4 16.95c1.9 1.4 3.74 2.24 5.55 2.79.45-.62.85-1.27 1.2-1.96-.66-.24-1.3-.53-1.9-.86.16-.12.31-.24.46-.37 3.67 1.72 7.67 1.72 11.3 0 .15.13.3.25.46.37-.6.34-1.24.62-1.9.86.35.69.75 1.34 1.2 1.96 1.81-.55 3.65-1.4 5.55-2.79.45-4.78-.76-8.91-3.68-12.58ZM9 14.44c-1.1 0-2-.98-2-2.18 0-1.2.88-2.18 2-2.18 1.12 0 2 .98 2 2.18 0 1.2-.88 2.18-2 2.18Zm6 0c-1.1 0-2-.98-2-2.18 0-1.2.88-2.18 2-2.18 1.12 0 2 .98 2 2.18 0 1.2-.88 2.18-2 2.18Z"/></svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-wider uppercase mb-4">Products</h3>
              <ul className="space-y-3">
                <li><a href="/products/payments" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Payments</a></li>
                <li><a href="/products/checkout" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Checkout</a></li>
                <li><a href="/products/payment-links" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Payment Links</a></li>
                <li><a href="/products/subscriptions" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Subscriptions</a></li>
                <li><a href="/products/invoicing" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Invoicing</a></li>
                <li>
                  <a
                    href={WALLCARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    WallCard
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-wider uppercase mb-4">Resources</h3>
              <ul className="space-y-3">
                <li><a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Telegram Support</a></li>
                <li><a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Discord Community</a></li>
                <li><a href="https://status.noderails.com" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Status</a></li>
                <li><a href="/docs" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Guides</a></li>
                <li><a href="/blog" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Blog</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-wider uppercase mb-4">Developers</h3>
              <ul className="space-y-3">
                <li><a href="/docs" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Documentation</a></li>
                <li><a href="/docs/api-reference/checkout-sessions" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">API Reference</a></li>
                <li><a href="/docs/sdk" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">SDKs</a></li>
                <li><a href="https://github.com/noderails" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">GitHub</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-wider uppercase mb-4">Company</h3>
              <ul className="space-y-3">
                <li><a href="/about" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">About</a></li>
                <li><a href="/careers" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Careers</a></li>
                <li><a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">LinkedIn</a></li>
                <li><a href="/privacy" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Privacy</a></li>
                <li><a href="/terms" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          {/* Centered contact block */}
          <div className="w-full flex justify-center mt-10 mb-2">
            <div className="bg-slate-100 rounded-xl px-6 py-4 text-center shadow-sm border border-slate-200">
              <div className="text-sm text-slate-700 mb-1 font-medium">For queries and partnerships, reach out:</div>
              <a href="mailto:business@noderails.com" className="text-base font-semibold text-indigo-700 hover:underline">business@noderails.com</a>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs text-slate-500 mb-4 md:mb-0">
              NodeRails is a product of Maartandrise International Ventures Pvt. Ltd. Payments are settled directly to merchant wallets.
            </p>
            <div className="flex items-center gap-6">
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-900" aria-label="Discord">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.32 4.37A18.2 18.2 0 0 0 15.78 3c-.2.36-.43.84-.59 1.22a16.9 16.9 0 0 0-5.38 0A12.7 12.7 0 0 0 9.22 3c-1.6.27-3.12.74-4.54 1.37C1.8 8.65 1.02 12.83 1.4 16.95c1.9 1.4 3.74 2.24 5.55 2.79.45-.62.85-1.27 1.2-1.96-.66-.24-1.3-.53-1.9-.86.16-.12.31-.24.46-.37 3.67 1.72 7.67 1.72 11.3 0 .15.13.3.25.46.37-.6.34-1.24.62-1.9.86.35.69.75 1.34 1.2 1.96 1.81-.55 3.65-1.4 5.55-2.79.45-4.78-.76-8.91-3.68-12.58ZM9 14.44c-1.1 0-2-.98-2-2.18 0-1.2.88-2.18 2-2.18 1.12 0 2 .98 2 2.18 0 1.2-.88 2.18-2 2.18Zm6 0c-1.1 0-2-.98-2-2.18 0-1.2.88-2.18 2-2.18 1.12 0 2 .98 2 2.18 0 1.2-.88 2.18-2 2.18Z"/></svg>
              </a>
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-900" aria-label="Telegram">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21.47 4.35a1 1 0 0 0-1.06-.16L2.89 11.18a1 1 0 0 0 .09 1.88l4.27 1.36 1.6 5.08a1 1 0 0 0 1.71.36l2.38-2.44 4.66 3.43a1 1 0 0 0 1.58-.59l2.5-14.78a1 1 0 0 0-.21-.83ZM9.04 14.28l8.6-6.18-6.87 7.09-.44 2.43-1.29-3.34Z"/></svg>
              </a>
              <a href="/terms" className="text-xs text-slate-500 hover:text-slate-900">Terms &amp; Conditions</a>
              <a href="/privacy" className="text-xs text-slate-500 hover:text-slate-900">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>

      <FeedbackWidget />
    </div>
  );
}

/* ── Reusable Components ── */

const colorMap = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600' },
} as const;

function ProductCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: keyof typeof colorMap;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow group">
      <div className={`w-12 h-12 rounded-lg ${colorMap[color].bg} ${colorMap[color].text} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-lg font-semibold text-slate-900 mb-2">{title}</h4>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
