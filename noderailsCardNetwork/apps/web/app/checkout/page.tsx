"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ShieldCheck, Sparkles, CreditCard, Lock, KeyRound } from "lucide-react";
import { Badge, Button, Card, Input } from "@noderails-card/ui";

type PayStep = "cart" | "pan" | "cvv" | "pin" | "otp" | "done";

function formatPanDisplay(digits: string) {
  const clean = digits.replace(/\D/g, "").slice(0, 16);
  const parts = clean.match(/.{1,4}/g) ?? [];
  return parts.join(" ");
}

export default function CheckoutDemoPage() {
  const [step, setStep] = useState<PayStep>("cart");
  const [pan, setPan] = useState("");
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");

  const panDigits = useMemo(() => pan.replace(/\D/g, ""), [pan]);
  const panValid = panDigits.length === 16;



  return (
    <div className="min-h-screen bg-canvas-subtle/60">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <Badge tone="violet">
            <Sparkles className="h-3 w-3" /> Card checkout demo · offline UI
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_380px]">
        <section>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">Merchant</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-ink">
            Morning Owl Coffee · Checkout
          </h1>
          <p className="mt-2 max-w-md text-[14.5px] text-ink-muted">
            Typical checkout. On the right, WallCard collects{" "}
            <span className="font-medium text-ink">card number, CVV, PIN,</span> then{" "}
            <span className="font-medium text-ink">OTP</span>, not a browser-wallet extension.
          </p>

          <Card className="mt-8 overflow-hidden p-0">
            <div className="flex items-center gap-4 border-b border-line p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 text-xl text-white">
                ☕
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">Two flat whites · pastry box</p>
                <p className="text-[13px] text-ink-muted">Pickup · Valencia St</p>
              </div>
              <Badge tone="neutral">In-store POS</Badge>
            </div>
            <CartRow label="Subtotal" value="$21.70" />
            <CartRow label="City surcharge" value="$2.42" />
            <CartRow label="Bag fee" value="$0.70" />
            <div className="flex items-center justify-between border-t border-line bg-canvas-subtle/80 px-5 py-4">
              <span className="text-[13px] font-semibold text-ink-muted">Total due</span>
              <span className="text-[22px] font-semibold tracking-tight text-ink">$24.82</span>
            </div>
          </Card>

          <div className="mt-6 flex flex-wrap gap-4 text-[12px] text-ink-subtle">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Card fields · not a wallet extension
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              Fields isolated from merchant markup (demo posture)
            </span>
          </div>
        </section>

        <section className="lg:pt-[44px]">
          <Card className="sticky top-[88px] overflow-hidden border-brand/25 p-0 shadow-[var(--shadow-card-lg)] ring-1 ring-brand/15">
            <div className="flex items-center justify-between border-b border-line bg-brand-soft/60 px-4 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-ink">
                <CreditCard className="h-3.5 w-3.5" /> NodeRails WallCard
              </span>
              <Badge tone="success">
                <ShieldCheck className="h-3 w-3" /> Verified merchant
              </Badge>
            </div>

            <div className="px-5 pb-6 pt-4">
              <div className="mb-6 flex gap-1.5">
                {[0, 1, 2, 3].map((i) => {
                  const progress: Record<PayStep, number> = { cart: -1, pan: 0, cvv: 1, pin: 2, otp: 3, done: 4 };
                  const cur = progress[step];
                  const tone =
                    step === "done"
                      ? "bg-emerald-500"
                      : cur > i
                        ? "bg-brand"
                        : cur === i
                          ? "bg-brand/70"
                          : "bg-line";
                  return <span key={i} className={`h-1 flex-1 rounded-full ${tone}`} />;
                })}
              </div>

              {step === "cart" && (
                <div className="space-y-4 nrc-fade-up">
                  <div>
                    <p className="text-[17px] font-semibold text-ink">Pay $24.82</p>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      Use your issued WallCard. You&apos;ll enter card number and CVV, then PIN and OTP.
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-muted">
                    <p className="font-medium text-ink">Morning Owl Coffee</p>
                    <p className="mt-2 font-mono">Auth hold · $24.82 USD</p>
                  </div>
                  <Button variant="secondary" className="w-full py-5 text-[15px]" onClick={() => setStep("pan")}>
                    Enter card details
                  </Button>
                  <button type="button" className="w-full text-center text-[12.5px] font-medium text-ink-muted hover:text-ink">
                    Use a different payment method
                  </button>
                </div>
              )}

              {step === "pan" && (
                <div className="space-y-4 nrc-fade-up">
                  <StepTitle icon={CreditCard} kicker="Step 1" title="Card number" hint="16 digits · your virtual WallCard number" />
                  <Input
                    label="Card number"
                    placeholder="4815 0000 0000 0000"
                    value={formatPanDisplay(panDigits)}
                    onChange={(e) => setPan(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    hint="Demo only; data stays in this browser session."
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep("cart")}>
                      Back
                    </Button>
                    <Button variant="secondary" className="flex-1" disabled={!panValid} onClick={() => setStep("cvv")}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {step === "cvv" && (
                <div className="space-y-4 nrc-fade-up">
                  <StepTitle icon={ShieldCheck} kicker="Step 2" title="CVV" hint="3 digits on the back of your virtual card" />
                  <Input
                    label="Security code"
                    inputMode="numeric"
                    placeholder="···"
                    maxLength={4}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep("pan")}>
                      Back
                    </Button>
                    <Button variant="secondary" className="flex-1" disabled={cvv.length < 3} onClick={() => setStep("pin")}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {step === "pin" && (
                <div className="space-y-4 nrc-fade-up">
                  <StepTitle icon={Lock} kicker="Step 3" title="Card PIN" hint="The PIN you set in the member app" />
                  <Input
                    label="PIN"
                    type="password"
                    inputMode="numeric"
                    placeholder="••••••"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep("cvv")}>
                      Back
                    </Button>
                    <Button variant="secondary" className="flex-1" disabled={pin.length < 4} onClick={() => setStep("otp")}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {step === "otp" && (
                <div className="space-y-4 nrc-fade-up">
                  <StepTitle
                    icon={KeyRound}
                    kicker="Step 4"
                    title="One-time code"
                    hint="SMS to •••• 291 · in dev, any 6 digits works."
                  />
                  <OtpSlots value={otp} onChange={setOtp} />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep("pin")}>
                      Back
                    </Button>
                    <Button variant="secondary" className="flex-1" disabled={otp.replace(/\D/g, "").length < 6} onClick={() => setStep("done")}>
                      Authorize payment
                    </Button>
                  </div>
                </div>
              )}

              {step === "done" && (
                <div className="space-y-5 text-center nrc-fade-up">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-[26px] text-emerald-600">
                    ✓
                  </div>
                  <div>
                    <p className="text-[18px] font-semibold text-ink">Payment approved</p>
                    <p className="mt-2 text-[13px] text-ink-muted">
                      Auth code <span className="font-mono text-ink">A9F‑2841‑CC</span> · Card ending 8472
                    </p>
                  </div>
                  <Card className="border-line bg-surface px-4 py-3 text-left text-[13px]">
                    <Row label="Merchant" value="Morning Owl Coffee" />
                    <Row label="Amount" value="$24.82" last />
                  </Card>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setPan("");
                      setCvv("");
                      setPin("");
                      setOtp("");
                      setStep("cart");
                    }}
                  >
                    Run another checkout
                  </Button>
                </div>
              )}
            </div>
          </Card>
          <p className="mx-auto mt-4 max-w-sm text-center text-[11px] text-ink-subtle">
            Demo UI only; wiring to live auth clears in a later sprint.
          </p>
        </section>
      </main>
    </div>
  );
}

function StepTitle({
  icon: Icon,
  kicker,
  title,
  hint
}: {
  icon: typeof CreditCard;
  kicker: string;
  title: string;
  hint: string;
}) {
  return (
    <div>
      <Badge tone="brand" className="mb-3">
        <Icon className="h-3 w-3" /> {kicker}
      </Badge>
      <p className="text-[18px] font-semibold tracking-tight text-ink">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

function CartRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

function Row({
  label,
  value,
  last
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 py-2 ${last ? "" : "border-b border-line/60"}`}>
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function OtpSlots({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const slots = 6;
  const clean = value.replace(/\D/g, "").slice(0, slots);
  const chars = clean.padEnd(slots, " ").split("");
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-ink">SMS code</span>
      <input
        className="sr-only"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="OTP"
        value={clean}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, slots))}
      />
      <div className="flex gap-1.5">
        {chars.map((c, i) => {
          const filled = c.trim().length > 0;
          const focus = i === clean.length && clean.length < slots;
          return (
            <span
              key={i}
              className={`flex h-11 flex-1 items-center justify-center rounded-lg border text-[17px] font-semibold ${
                filled
                  ? "border-brand/35 bg-brand-soft/40 text-brand-ink"
                  : focus
                    ? "border-brand/50 ring-2 ring-brand/20 text-ink"
                    : "border-line bg-surface text-ink-muted"
              }`}
            >
              {filled ? c : "·"}
            </span>
          );
        })}
      </div>
    </label>
  );
}
