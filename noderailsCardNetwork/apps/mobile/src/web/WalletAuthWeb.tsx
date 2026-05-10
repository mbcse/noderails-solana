import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Button, Card, Input } from "@noderails-card/ui";

const apiBase =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://localhost:9080";
const webCheckoutBase =
  process.env.EXPO_PUBLIC_WEB_URL?.trim() ||
  process.env.EXPO_PUBLIC_WALLCARD_WEB_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
  "http://localhost:3300";

type Stage = "email" | "code" | "done";

function readInitialReturnOrigin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get("return_origin");
  } catch {
    return null;
  }
}

function AuthPageContent() {
  const [returnOriginRaw] = useState(() => readInitialReturnOrigin());
  const sessionDeliveredRef = useRef(false);

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    setBusy(true);
    setHint(null);
    try {
      const res = await fetch(`${apiBase}/v1/auth/otp/request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ email, purpose: "login" })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send code");
      setHint("Enter the 6-digit code from your email.");
      setStage("code");
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Could not reach API");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setHint(null);
    try {
      const res = await fetch(`${apiBase}/v1/auth/otp/verify`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ email, code: otp })
      });
      const body = await res.json();
      if (body.accessToken) {
        localStorage.setItem("noderails_card_access_token", body.accessToken);
        setStage("done");
      } else {
        setHint(body.error ?? "OTP verification failed");
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Could not reach API");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (stage !== "done" || sessionDeliveredRef.current || !returnOriginRaw) return;
    const token = localStorage.getItem("noderails_card_access_token");
    if (!token || token.length < 10) return;
    try {
      const target = new URL(returnOriginRaw).origin;
      if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "noderails-card:session", accessToken: token }, target);
        sessionDeliveredRef.current = true;
      }
    } catch {
      /* invalid return_origin */
    }
  }, [stage, returnOriginRaw]);

  return (
    <div className="flex flex-col gap-5">
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </a>

      <Card className="p-6">
        <Stepper stage={stage} />

        {stage === "email" ? (
          <div className="space-y-5 nrc-fade-up">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
                Verify
              </p>
              <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.01em] text-ink">
                Sign in to your account
              </h1>
              <p className="mt-2 text-[13.5px] text-ink-muted">
                We&apos;ll email you a one-time code. No passwords.
              </p>
            </div>

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              leading={<Mail className="h-3.5 w-3.5" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button
              variant="secondary"
              className="w-full"
              size="lg"
              onClick={requestOtp}
              disabled={!email.includes("@") || busy}
            >
              {busy ? "Sending…" : "Send one-time code"}
            </Button>
          </div>
        ) : null}

        {stage === "code" ? (
          <div className="space-y-5 nrc-fade-up">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand">
                Enter code
              </p>
              <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.01em] text-ink">
                Check your inbox
              </h1>
              <p className="mt-2 text-[13.5px] text-ink-muted">
                We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
              </p>
            </div>

            <OtpInput value={otp} onChange={setOtp} />

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={verifyOtp}
              disabled={otp.length < 4 || busy}
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </Button>

            <button
              type="button"
              onClick={() => setStage("email")}
              className="w-full text-center text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              Use a different email
            </button>
          </div>
        ) : null}

        {stage === "done" ? (
          <div className="space-y-5 text-center nrc-fade-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
                You&apos;re verified
              </h1>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">
                Session stored on this device. Pay on the web with your card flow, or open the PIN-only legacy tool for integrations.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="lg" className="w-full" asChild>
                <a href={`${webCheckoutBase.replace(/\/$/, "")}/checkout`}>Try card checkout (demo)</a>
              </Button>
              <Button variant="outline" size="lg" className="w-full" asChild>
                <a href="/sign">Open signing flow</a>
              </Button>
            </div>
          </div>
        ) : null}

        {hint ? (
          <p className="mt-4 rounded-lg border border-line bg-canvas-muted px-3 py-2 text-[12.5px] text-ink-muted">
            {hint}
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Why we ask</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              OTP verifies it&apos;s really you opening the member app. On a merchant site, shoppers enter card number, CVV, PIN, and OTP, not a wallet popup.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stepper({ stage }: { stage: Stage }) {
  const stages: Stage[] = ["email", "code", "done"];
  const idx = stages.indexOf(stage);
  return (
    <div className="mb-6 flex items-center gap-1.5">
      {stages.map((s, i) => (
        <span
          key={s}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= idx ? "bg-brand" : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const slots = 6;
  const chars = value.padEnd(slots, " ").slice(0, slots).split("");
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">One-time code</span>
      <div className="relative">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={slots}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, slots))}
          className="absolute inset-0 h-full w-full opacity-0"
        />
        <div className="flex items-center gap-2">
          {chars.map((c, i) => {
            const filled = c.trim().length > 0;
            const cursor = i === value.length;
            return (
              <span
                key={i}
                className={`flex h-12 flex-1 items-center justify-center rounded-lg border bg-surface text-[18px] font-semibold tracking-wider transition-colors ${
                  filled
                    ? "border-brand/50 text-ink"
                    : cursor
                    ? "border-brand/40 ring-2 ring-brand/15 text-ink"
                    : "border-line text-ink-subtle"
                }`}
              >
                {filled ? c : "•"}
              </span>
            );
          })}
        </div>
      </div>
    </label>
  );
}

export default function WalletAuthWeb() {
  return <AuthPageContent />;
}
