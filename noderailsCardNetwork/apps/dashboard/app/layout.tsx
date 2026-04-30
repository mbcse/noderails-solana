import type { ReactNode } from "react";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import {
  Activity, Boxes, CheckCircle2, Code2, Cog, Compass, KeyRound, ShieldCheck, Webhook
} from "lucide-react";
import { WallCardLogo } from "@noderails-card/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

const walletUrl =
  process.env.NEXT_PUBLIC_WALLCARD_WEB_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_MOBILE_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_WALLET_URL?.trim() ||
  "http://localhost:8090";
const webUrl    = process.env.NEXT_PUBLIC_WEB_URL    ?? "http://localhost:3300";

const nav = [
  { label: "Overview",        href: "/",  icon: Compass,   active: true },
  { label: "Merchants",       href: "#",  icon: Boxes },
  { label: "Authorizations",  href: "#",  icon: Activity },
  { label: "Webhooks",        href: "#",  icon: Webhook },
  { label: "Keys & secrets",  href: "#",  icon: KeyRound },
  { label: "Settings",        href: "#",  icon: Cog },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas-subtle font-sans text-ink antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-canvas lg:flex">
            <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
              <WallCardLogo size={28} className="h-7 w-auto shrink-0 drop-shadow-sm" />
              <div className="leading-tight">
                <p className="text-[13px] font-semibold tracking-tight text-ink">WallCard</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-subtle">Program console</p>
              </div>
            </div>

            <nav className="flex-1 space-y-0.5 p-2.5">
              <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">Workspace</p>
              {nav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    item.active
                      ? "bg-brand-soft text-brand-ink"
                      : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
                  }`}
                >
                  <item.icon className={`h-3.5 w-3.5 ${item.active ? "text-brand" : "text-ink-subtle group-hover:text-ink-muted"}`} />
                  {item.label}
                </Link>
              ))}

              <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">Resources</p>
              {[
                { href: `${webUrl}/docs`,     icon: Code2,       label: "API reference" },
                { href: `${walletUrl}/auth`,  icon: ShieldCheck, label: "WallCard sign-in" },
              ].map((r) => (
                <Link key={r.label} href={r.href} className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted hover:bg-canvas-muted hover:text-ink">
                  <r.icon className="h-3.5 w-3.5 text-ink-subtle" />
                  {r.label}
                </Link>
              ))}
            </nav>

            <div className="m-2.5 rounded-xl border border-line bg-canvas-subtle p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <p className="text-[12px] font-semibold text-ink">Local mode</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                Postgres, Redis and signer-host are simulated.
              </p>
            </div>
          </aside>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-5 backdrop-blur lg:px-8">
              <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                <span className="hidden font-medium text-ink lg:inline">Acme</span>
                <span className="hidden text-ink-subtle lg:inline">/</span>
                <span className="font-medium text-ink">Overview</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-muted sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Local · v0.1.0
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-[11px] font-bold text-white">
                  AC
                </span>
              </div>
            </header>
            <main className="flex-1 px-5 py-8 lg:px-8 lg:py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
