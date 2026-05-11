"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Code2, ShieldCheck, X, Zap } from "lucide-react";
import { Badge, Button, Card, Input, WallCardLogo } from "@noderails-card/ui";

type PayStep = "cart" | "pan" | "cvv" | "pin" | "otp" | "done";

function formatPanDisplay(digits: string) {
  const clean = digits.replace(/\D/g, "").slice(0, 16);
  const parts = clean.match(/.{1,4}/g) ?? [];
  return parts.join(" ");
}

type SdkMethod =
  | "personal_sign"
  | "eth_sign"
  | "eth_signTypedData_v4"
  | "eth_sendTransaction"
  | "solana_signMessage";

const SDK_METHODS: {
  id: SdkMethod;
  chain: "EVM" | "Solana";
  label: string;
  subtitle: string;
}[] = [
  { id: "personal_sign", chain: "EVM", label: "personal_sign", subtitle: "UTF-8 hex · same as wallet extensions / ethers" },
  { id: "solana_signMessage", chain: "Solana", label: "solana_signMessage", subtitle: "Message bytes · @solana/web3.js style" },
  { id: "eth_sendTransaction", chain: "EVM", label: "eth_sendTransaction", subtitle: "Sign & send tx · like BrowserProvider" },
  { id: "eth_signTypedData_v4", chain: "EVM", label: "eth_signTypedData_v4", subtitle: "EIP-712 typed data" },
  { id: "eth_sign", chain: "EVM", label: "eth_sign", subtitle: "Legacy 32-byte signing" },
];

/** Interactive hero: toggle between staged card checkout (card number → CVV → PIN → OTP) and EVM/Solana SDK signing. */
export function HeroSigningDemo() {
  const [requestedMethod, setRequestedMethod] = useState<SdkMethod>("solana_signMessage");
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);

  return (
    <div className="relative">
      <div
        className="absolute -inset-x-6 -inset-y-6 rounded-[28px] bg-gradient-to-br from-violet-500/20 via-fuchsia-500/12 to-emerald-400/18 blur-[2px] md:-inset-x-10 md:-inset-y-10 md:rounded-[40px]"
        aria-hidden
      />
      <div className="absolute -inset-x-5 -inset-y-5 rounded-[26px] bg-gradient-to-tr from-indigo-400/25 via-transparent to-amber-300/20 md:-inset-x-8 md:-inset-y-8 md:rounded-[34px]" aria-hidden />

      <Card className="relative overflow-hidden border border-transparent bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-emerald-400/20 p-[1px] shadow-[0_24px_56px_-18px_rgba(99,102,241,0.35),var(--shadow-card-lg)]">
        <div className="overflow-hidden rounded-[calc(0.75rem-1px)] border border-line bg-canvas">
          <div className="flex flex-col gap-3 border-b border-line bg-gradient-to-r from-violet-500/[0.07] via-fuchsia-500/[0.06] to-emerald-500/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Interactive preview</p>
            <Badge tone="violet" className="self-start border-violet-400/35 bg-violet-500/12 text-violet-900 sm:self-auto dark:text-violet-100">
              <Code2 className="h-3 w-3" />
              Signing surface
            </Badge>
          </div>

          <SdkSigningPanel
            activeMethod={requestedMethod}
            onActiveMethodChange={setRequestedMethod}
            onOpenSigningScreen={(method) => {
              setRequestedMethod(method);
              setIsSigningModalOpen(true);
            }}
          />
        </div>
      </Card>

      {isSigningModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            aria-label="Close signing modal"
            className="absolute inset-0 bg-[rgb(10,10,18)]/55 backdrop-blur-md"
            onClick={() => setIsSigningModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-lg"
          >
            <Card className="overflow-hidden border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_32px_96px_rgba(0,0,0,0.45)]">
              <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-white via-indigo-50/35 to-violet-50/25 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <WallCardLogo size={36} className="h-9 w-auto shrink-0 drop-shadow-md" title="WallCard" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold tracking-tight text-ink">WallCard</p>
                    <p className="truncate text-[11px] text-ink-muted">Secure approval</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle sm:inline">Preview</span>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas-muted hover:text-ink"
                    onClick={() => setIsSigningModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <CardFlowPanel requestedMethod={requestedMethod} onBackToCommands={() => setIsSigningModalOpen(false)} />
            </Card>
          </motion.div>
        </div>
      ) : null}

      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-ink-subtle">
        <span className="font-medium text-ink">Commands tab:</span> pick{" "}
        <span className="font-mono text-[11px] text-ink">solana_signMessage</span>,{" "}
        <span className="font-mono text-[11px] text-ink">eth_sendTransaction</span>, or other methods.{" "}
        <span className="font-medium text-ink">Run:</span> opens signing screen with card number, CVV, PIN, OTP instead of wallet extension.{" "}
        <span className="font-medium text-ink">Method shape:</span> <span className="font-mono text-[11px] text-ink">provider.request</span> like{" "}
        <span className="font-medium text-ink">ethers</span> and <span className="font-medium text-ink">Solana</span> tooling. Full demos:{" "}
        <Link href="/checkout" className="font-semibold text-brand hover:underline">
          checkout
        </Link>
        {" · "}
        <Link href="/examples" className="font-semibold text-brand hover:underline">
          SDK playground
        </Link>
        .
      </p>
    </div>
  );
}

function CardFlowPanel({
  requestedMethod,
  onBackToCommands
}: {
  requestedMethod: SdkMethod;
  onBackToCommands: () => void;
}) {
  const [step, setStep] = useState<PayStep>("pan");
  const [pan, setPan] = useState("");
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");

  const panDigits = pan.replace(/\D/g, "");
  const panValid = panDigits.length === 16;
  const otpDigits = otp.replace(/\D/g, "");

  const reset = () => {
    setStep("cart");
    setPan("");
    setCvv("");
    setPin("");
    setOtp("");
  };

  const progressIdx: Record<PayStep, number> = { cart: -1, pan: 0, cvv: 1, pin: 2, otp: 3, done: 4 };

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-white via-canvas-subtle to-emerald-50/30 px-4 py-2.5">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} /> Step-up verification
        </span>
        <Badge tone="success" className="border-emerald-200/80 bg-emerald-50/90">
          <ShieldCheck className="h-3 w-3" /> Encrypted
        </Badge>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-5 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => {
            const cur = progressIdx[step];
            const tone =
              step === "done"
                ? "bg-emerald-500"
                : cur > i
                  ? "bg-brand"
                  : cur === i
                    ? "bg-brand/70"
                    : "bg-line";
            return <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${tone}`} title={`Step ${i + 1}`} />;
          })}
        </div>
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
          {step === "cart" && "Awaiting approval"}
          {step === "pan" && "Step 1 · Card number"}
          {step === "cvv" && "Step 2 · Security code (CVV)"}
          {step === "pin" && "Step 3 · Card PIN"}
          {step === "otp" && "Step 4 · One-time code (OTP)"}
          {step === "done" && "Approved"}
        </p>

        {step === "cart" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-[13px] font-semibold text-ink">Signature request</p>
              <p className="mt-1 font-mono text-[12px] text-ink-muted">{requestedMethod}</p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
                Card number, security code, PIN, and email verification — same flow as the live WallCard sheet.
              </p>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              When your app calls <span className="font-mono text-ink">provider.request</span>, members complete approval here instead of a browser extension.
            </p>
            <Button data-testid="btn-card-enter-details" variant="secondary" className="w-full py-5 text-[15px]" onClick={() => setStep("pan")}>
              Continue signing
            </Button>
            <Button variant="outline" className="w-full" onClick={onBackToCommands}>
              Close
            </Button>
          </div>
        )}

        {step === "pan" && (
          <div className="space-y-4">
            <Input
              label="Card number"
              placeholder="4815 0000 0000 0000"
              value={formatPanDisplay(panDigits)}
              onChange={(e) => setPan(e.target.value.replace(/\D/g, "").slice(0, 16))}
              hint="16 digits on your WallCard"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("cart")}>
                Back
              </Button>
              <Button data-testid="btn-card-step-pan-continue" variant="secondary" className="flex-1" disabled={!panValid} onClick={() => setStep("cvv")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "cvv" && (
          <div className="space-y-4">
            <Input
              label="CVV"
              inputMode="numeric"
              placeholder="···"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              hint="3–4 digits on your virtual card"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("pan")}>
                Back
              </Button>
              <Button data-testid="btn-card-step-cvv-continue" variant="secondary" className="flex-1" disabled={cvv.length < 3} onClick={() => setStep("pin")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "pin" && (
          <div className="space-y-4">
            <Input
              label="Card PIN"
              type="password"
              inputMode="numeric"
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              hint="PIN you set in the member app"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("cvv")}>
                Back
              </Button>
              <Button data-testid="btn-card-step-pin-continue" variant="secondary" className="flex-1" disabled={pin.length < 4} onClick={() => setStep("otp")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <Input
              label="SMS one-time code"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              hint="6 digits · in dev, any 6 works"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("pin")}>
                Back
              </Button>
              <Button data-testid="btn-card-step-otp-authorize" variant="secondary" className="flex-1" disabled={otpDigits.length < 6} onClick={() => setStep("done")}>
                Authorize
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-[26px] text-emerald-600">
              ✓
            </div>
            <div>
              <p className="text-[17px] font-semibold text-ink">Signature approved</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Method <span className="font-mono text-ink">{requestedMethod}</span> · request <span className="font-mono text-ink">rq_7f91</span>
              </p>
            </div>
            <Button data-testid="btn-card-run-again" variant="secondary" className="w-full" onClick={reset}>
              Run again
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function SdkSigningPanel({
  activeMethod,
  onActiveMethodChange,
  onOpenSigningScreen
}: {
  activeMethod: SdkMethod;
  onActiveMethodChange: (method: SdkMethod) => void;
  onOpenSigningScreen: (method: SdkMethod) => void;
}) {
  const [running, setRunning] = useState(false);

  const meta = SDK_METHODS.find((m) => m.id === activeMethod)!;

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      onOpenSigningScreen(activeMethod);
      setRunning(false);
    }, 220);
  };

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-violet-500/25 bg-gradient-to-r from-violet-950 via-[#13071f] to-emerald-950 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90 shadow-[0_0_10px_rgb(248_113_113/0.55)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90 shadow-[0_0_10px_rgb(251_191_36/0.45)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-[0_0_12px_rgb(52_211_153/0.65)]" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[11.5px] text-zinc-100">Solana &amp; EVM · common commands</p>
            <p className="font-mono text-[10px] text-violet-300/80">
              Solana message signing + EIP-1193 on Ethereum (ethers v6 BrowserProvider shape)
            </p>
          </div>
        </div>
        <Badge tone="violet" className="shrink-0 self-start border-fuchsia-400/35 bg-gradient-to-r from-fuchsia-600/35 to-violet-600/35 text-fuchsia-50 sm:self-auto">
          <Zap className="h-3 w-3" /> Runs in this page
        </Badge>
      </div>

      <div className="border-b border-line bg-gradient-to-r from-violet-500/[0.06] via-fuchsia-500/[0.05] to-emerald-500/[0.06] px-3 py-2">
        <div className="flex gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {SDK_METHODS.map((m) => {
            const on = m.id === activeMethod;
            const sol = m.chain === "Solana";
            const activeSol = on && sol;
            const activeEvm = on && !sol;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onActiveMethodChange(m.id);
                }}
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-left ring-1 transition-all ${
                  activeSol
                    ? "bg-gradient-to-br from-emerald-600/40 via-teal-900/60 to-[#0b0b12] text-white shadow-[0_0_24px_-4px_rgb(16_185_129/0.45)] ring-emerald-400/50"
                    : activeEvm
                      ? "bg-gradient-to-br from-indigo-600/45 via-violet-950/70 to-[#0b0b12] text-white shadow-[0_0_20px_-4px_rgb(99_102_241/0.4)] ring-violet-400/45"
                      : "bg-zinc-900/85 text-zinc-300 ring-transparent hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span className="block font-mono text-[11px] font-semibold">{m.label}</span>
                <span
                  className={`block text-[10px] ${activeSol ? "text-emerald-200/90" : activeEvm ? "text-violet-200/85" : "text-zinc-500"}`}
                >
                  {m.chain}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="border-b border-line bg-gradient-to-r from-canvas-subtle to-violet-500/[0.04] px-3 py-2 text-[10.5px] leading-snug text-ink-muted">
        Pick a method tab, then <span className="font-medium text-violet-700 dark:text-violet-200">Run request</span> to open the signing screen. Same{" "}
        <span className="font-mono text-[10px] text-ink">provider.request</span> shape as wallets.
      </p>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-violet-500/15 bg-gradient-to-br from-[#14091f] via-[#0b0b12] to-[#071a14] p-4 lg:border-b-0 lg:border-r lg:border-violet-500/15">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/70">Example code</p>
          <pre className="mt-2 max-h-[220px] overflow-auto font-mono text-[11.5px] leading-relaxed text-zinc-200">
            <code>{sdkRequestSnippet(activeMethod)}</code>
          </pre>
        </div>
        <div className="border-violet-500/15 bg-gradient-to-bl from-[#0d1628] via-[#0b0b12] to-[#04140f] p-4 lg:border-l-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/65">Response</p>
            <span className="text-[10px] text-fuchsia-300/70">{running ? "opening" : "ready"}</span>
          </div>
          <pre className="mt-2 max-h-[180px] overflow-auto font-mono text-[11.5px] leading-relaxed text-emerald-300/95">
            <code>{running ? "// opening signing screen..." : '// Click "Run request" to open signing screen'}</code>
          </pre>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-gradient-to-r from-violet-500/[0.06] via-canvas-subtle to-emerald-500/[0.05] px-4 py-3"
      >
        <p className="text-[12px] text-ink-muted">
          <span className="font-medium text-ink">{meta.label}</span>
          <span className="text-ink-subtle"> · </span>
          {meta.subtitle}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="btn-sdk-run-request" variant="secondary" size="sm" onClick={run} disabled={running} className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            {running ? "Opening…" : "Run request"}
          </Button>
          <Button data-testid="btn-sdk-full-playground" variant="outline" size="sm" asChild>
            <Link href="/examples">
              Full playground
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </>
  );
}

function sdkRequestSnippet(method: SdkMethod): string {
  switch (method) {
    case "personal_sign":
      return `provider.request({
  method: "personal_sign",
  params: [hexMessage, "0xdemo…42"]
});`;
    case "eth_sign":
      return `provider.request({
  method: "eth_sign",
  params: ["0xdemo…42", "0xdeadbeef"]
});`;
    case "eth_signTypedData_v4":
      return `provider.request({
  method: "eth_signTypedData_v4",
  params: [address, typedDataJson]
});`;
    case "eth_sendTransaction":
      return `provider.request({
  method: "eth_sendTransaction",
  params: [{
    from: "0xdemo…42",
    to: "0xmerchant…9f",
    value: "0x2386f26fc10000",
    data: "0x"
  }]
});`;
    case "solana_signMessage":
      return `provider.request({
  method: "solana_signMessage",
  params: ["hello-from-hero"]
});`;
    default:
      return "";
  }
}

