import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Fingerprint,
  Lock,
  ShieldCheck,
  KeyRound,
  RefreshCw
} from "lucide-react";
import { Badge, Button, Card, Input, WallCardLogo } from "@noderails-card/ui";
import { buildWallCardSigningPayload, type WallCardRpcIntent } from "@noderails-card/sdk-core";

const apiBase =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://localhost:9080";

/** Same limits as mobile Sign confirm tab */
const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_MAX_EMAILS_PER_SIGNING_FLOW = 6;

type Stage =
  | "await_intent"
  | "card_cvv"
  | "pin_otp"
  | "signing"
  | "done"
  | "error"
  | "missing_origin";

type SigningBundle = {
  chain: "evm" | "solana";
  method: string;
  payload: Record<string, unknown>;
};

function emailFromAccessToken(token: string): string | null {
  try {
    const parts = token.split(".");
    const payload = parts[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = globalThis.atob(b64 + pad);
    const data = JSON.parse(json) as { email?: string };
    return typeof data.email === "string" && data.email.includes("@") ? data.email : null;
  } catch {
    return null;
  }
}

function readSignQuery(): { requestId: string; parentOriginParam: string; isEmbed: boolean } {
  if (typeof window === "undefined") {
    return { requestId: "", parentOriginParam: "", isEmbed: false };
  }
  const q = new URLSearchParams(window.location.search);
  return {
    requestId: q.get("rid") ?? "",
    parentOriginParam: q.get("parentOrigin") ?? "",
    isEmbed: q.get("mode") === "iframe",
  };
}

export function WalletSignWeb() {
  const { requestId, parentOriginParam, isEmbed } = readSignQuery();

  const parentOrigin = useMemo(() => {
    try {
      if (!parentOriginParam) return "";
      return new URL(decodeURIComponent(parentOriginParam)).origin;
    } catch {
      return "";
    }
  }, [parentOriginParam]);

  const hostLabel = useMemo(() => {
    if (!parentOrigin) return "";
    try {
      return new URL(parentOrigin).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }, [parentOrigin]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isEmbed) document.body.dataset.nrcWalletEmbed = "iframe";
    else delete document.body.dataset.nrcWalletEmbed;
    return () => {
      delete document.body.dataset.nrcWalletEmbed;
    };
  }, [isEmbed]);

  const [stage, setStage] = useState<Stage>(parentOrigin ? "await_intent" : "missing_origin");
  const [intent, setIntent] = useState<WallCardRpcIntent | null>(null);
  const [cardPanDigits, setCardPanDigits] = useState("");
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSentHint, setOtpSentHint] = useState<string | null>(null);
  const [otpEmailsSent, setOtpEmailsSent] = useState(0);
  const [otpLastSentAt, setOtpLastSentAt] = useState(0);
  const [otpResendBusy, setOtpResendBusy] = useState(false);
  const [, setOtpResendTick] = useState(0);
  const [error, setError] = useState("");
  const [signatureOut, setSignatureOut] = useState<string>("");
  const [sessionToken, setSessionToken] = useState("");
  const [cardStepBusy, setCardStepBusy] = useState(false);
  const [signingBundle, setSigningBundle] = useState<SigningBundle | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionToken(localStorage.getItem("noderails_card_access_token") ?? "");
  }, []);

  const postToParent = useCallback(
    (payload: Record<string, unknown>) => {
      if (!parentOrigin) return;
      if (typeof window === "undefined") return;
      window.parent?.postMessage(payload, parentOrigin);
      window.opener?.postMessage(payload, parentOrigin);
    },
    [parentOrigin]
  );

  useEffect(() => {
    if (!requestId || !parentOrigin) return;
    postToParent({ type: "noderails-card:ready", requestId });
  }, [requestId, parentOrigin, postToParent]);

  useEffect(() => {
    if (!parentOrigin || !requestId) return;

    function onMsg(ev: MessageEvent) {
      if (ev.origin !== parentOrigin) return;

      if (ev.data?.type === "noderails-card:bearer" && ev.data.requestId === requestId) {
        const t = ev.data.accessToken;
        if (typeof t === "string" && t.length >= 10) {
          setSessionToken(t);
          try {
            localStorage.setItem("noderails_card_access_token", t);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (ev.data?.type !== "noderails-card:intent") return;
      if (ev.data.requestId !== requestId) return;
      const next = ev.data.intent as WallCardRpcIntent;
      if (!next?.method || typeof next.chainIdHex !== "string") {
        const msg = "invalid_intent";
        setError(msg);
        setStage("error");
        postToParent({ type: "noderails-card:error", requestId, payload: { error: msg } });
        return;
      }
      setIntent(next);
      setSigningBundle(null);
      setStage("card_cvv");
    }

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [parentOrigin, requestId, postToParent]);

  useEffect(() => {
    if (stage !== "pin_otp") return;
    const id = window.setInterval(() => setOtpResendTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  const requestSigningOtp = async (tokenOverride?: string) => {
    const tkn = tokenOverride ?? sessionToken;
    const email = emailFromAccessToken(tkn);
    if (!email) {
      throw new Error(
        tkn.length < 10
          ? "Enter card number + CVV — wallet login is not required."
          : "Session token has no email — verify card again."
      );
    }
    const otpRes = await fetch(`${apiBase}/v1/auth/otp/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID()
      },
      body: JSON.stringify({ email, purpose: "signing" })
    });
    const otpBody = await otpRes.json().catch(() => ({}));
    if (!otpRes.ok) throw new Error(typeof otpBody.error === "string" ? otpBody.error : "otp_request_failed");
    setOtpSentHint("We sent a 6-digit code to your email.");
  };

  const proceedCardStep = async () => {
    if (!intent) return;
    setError("");
    setSigningBundle(null);
    const digits = cardPanDigits.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) {
      setError("Enter a valid card number (13–19 digits).");
      return;
    }
    const cvvDigits = cvv.replace(/\D/g, "");
    if (cvvDigits.length < 3) {
      setError("Enter CVV (3–4 digits).");
      return;
    }

    setCardStepBusy(true);
    try {
      const sessRes = await fetch(`${apiBase}/v1/card-signing/session`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          panDigits: digits,
          cvvDigits
        })
      });
      const sessBody = (await sessRes.json().catch(() => ({}))) as { accessToken?: string; error?: string };
      if (!sessRes.ok) {
        throw new Error(
          sessBody.error === "invalid_card_or_cvv"
            ? "Card number or CVV does not match your issued WallCard."
            : typeof sessBody.error === "string"
              ? sessBody.error
              : "card_verify_failed"
        );
      }
      const accessToken = sessBody.accessToken;
      if (!accessToken || accessToken.length < 10) {
        throw new Error("card_session_failed");
      }
      setSessionToken(accessToken);
      try {
        localStorage.setItem("noderails_card_access_token", accessToken);
      } catch {
        /* ignore */
      }

      const accRes = await fetch(`${apiBase}/v1/wallet/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
      });
      const accBody = (await accRes.json().catch(() => ({}))) as {
        data?: Array<{ chainFamily: string; address: string }>;
      };
      if (!accRes.ok) {
        throw new Error("accounts_fetch_failed");
      }
      const rows = accBody.data ?? [];
      const evm = rows.find((a) => a.chainFamily === "evm")?.address ?? "";
      const sol = rows.find((a) => a.chainFamily === "solana")?.address ?? "";

      const built = buildWallCardSigningPayload({
        method: intent.method,
        params: intent.params,
        chainIdHex: intent.chainIdHex,
        evmAddress: evm,
        solAddress: sol
      });
      setSigningBundle(built);

      await requestSigningOtp(accessToken);
      setOtpEmailsSent(1);
      setOtpLastSentAt(Date.now());
      setStage("pin_otp");
    } catch (e) {
      const message = e instanceof Error ? e.message : "otp_request_failed";
      setError(message);
    } finally {
      setCardStepBusy(false);
    }
  };

  const submitSigning = async () => {
    if (!intent || !signingBundle) return;
    setStage("signing");
    setError("");
    try {
      const createRes = await fetch(`${apiBase}/v1/signing-requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sessionToken}`,
          "idempotency-key": requestId || crypto.randomUUID()
        },
        body: JSON.stringify({
          chain: signingBundle.chain,
          method: signingBundle.method,
          payload: signingBundle.payload,
          requestSource: "wallet_sdk_iframe",
          requestOrigin: parentOrigin || (typeof window !== "undefined" ? window.location.origin : "")
        })
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "create_failed");

      const otpDigits = otp.replace(/\D/g, "").slice(0, 6);
      if (otpDigits.length !== 6) throw new Error("otp_required");

      const confirmRes = await fetch(`${apiBase}/v1/signing-requests/${created.id}/confirm`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sessionToken}`,
          "idempotency-key": `${requestId || crypto.randomUUID()}-confirm`
        },
        body: JSON.stringify({
          pin,
          useOtp: true,
          otpCode: otpDigits
        })
      });
      const confirmed = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmed.error ?? "signing_failed");

      const sig = typeof confirmed.signature === "string" ? confirmed.signature : "";
      setSignatureOut(sig);
      setStage("done");
      postToParent({
        type: "noderails-card:success",
        requestId,
        payload: {
          result: sig,
          signature: sig,
          signingOutput: confirmed.signingOutput
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown_error";
      setStage("error");
      setError(message);
      postToParent({ type: "noderails-card:error", requestId, payload: { error: message } });
    }
  };

  const handleResendSigningOtp = async () => {
    const cooldownLeft = Math.max(0, otpLastSentAt + OTP_RESEND_COOLDOWN_MS - Date.now());
    if (otpEmailsSent >= OTP_MAX_EMAILS_PER_SIGNING_FLOW || cooldownLeft > 0 || otpResendBusy) return;
    setOtpResendBusy(true);
    setError("");
    try {
      await requestSigningOtp();
      setOtpEmailsSent((n) => n + 1);
      setOtpLastSentAt(Date.now());
      setOtp("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "otp_request_failed");
    } finally {
      setOtpResendBusy(false);
    }
  };

  const otpCooldownLeftMs =
    stage === "pin_otp" ? Math.max(0, otpLastSentAt + OTP_RESEND_COOLDOWN_MS - Date.now()) : 0;
  const otpCooldownSec = Math.ceil(otpCooldownLeftMs / 1000);
  const canResendSigningOtp =
    stage === "pin_otp" &&
    otpEmailsSent < OTP_MAX_EMAILS_PER_SIGNING_FLOW &&
    otpCooldownLeftMs === 0 &&
    !otpResendBusy;

  const cancel = () => {
    postToParent({ type: "noderails-card:cancel", requestId });
  };

  return (
    <div className={`flex flex-col ${isEmbed ? "gap-3" : "gap-5"}`}>
      {!isEmbed ? (
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </a>
      ) : (
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-line-strong/80" aria-hidden />
      )}

      <Card className={`overflow-hidden p-0 shadow-[var(--shadow-card-lg)] ${isEmbed ? "ring-1 ring-black/[0.04]" : ""}`}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-white via-indigo-50/40 to-violet-50/30 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <WallCardLogo size={40} className="h-10 w-auto shrink-0 drop-shadow-md" title="WallCard" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-ink">WallCard</p>
              <p className="truncate text-[11.5px] text-ink-muted">
                {hostLabel ? `Request from ${hostLabel}` : "Secure approval"}
              </p>
            </div>
          </div>
          <Badge tone="success" className="shrink-0 border-emerald-200/80 bg-emerald-50/90">
            <ShieldCheck className="h-3 w-3" /> Encrypted
          </Badge>
        </div>

        <div className={isEmbed ? "p-4 sm:p-5" : "p-6"}>
          {stage === "missing_origin" ? (
            <div className="space-y-4 nrc-fade-up">
              <p className="text-[13px] text-ink-muted">
                Open this screen from an integrated app (<span className="font-mono">createNoderailsCardProvider</span>, iframe or
                popup). Standalone visits cannot receive signing requests across origins.
              </p>
              <Button variant="outline" asChild>
                <a href="/auth">Sign in to wallet</a>
              </Button>
            </div>
          ) : null}

          {stage === "await_intent" ? (
            <div className="space-y-5 text-center nrc-fade-up">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100">
                <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-indigo-200 border-t-indigo-600" />
              </div>
              <p className="text-[16px] font-semibold tracking-tight text-ink">Almost there</p>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Your application is connecting a signing request. When it arrives, confirm with card details, PIN, and email verification.
              </p>
              <p className="rounded-xl border border-line bg-white/80 px-4 py-3 text-left text-[12px] leading-relaxed text-ink-muted shadow-sm">
                No extension install — approval stays inside this WallCard flow.
              </p>
              <Button variant="outline" className="w-full" onClick={cancel}>
                Cancel
              </Button>
            </div>
          ) : null}

          {stage === "card_cvv" && intent ? (
            <div className="space-y-5 nrc-fade-up">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">Verify card</p>
                <h1 className="mt-2 text-[21px] font-semibold tracking-[-0.02em] text-ink">Confirm your WallCard</h1>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                  Enter the card number and security code on file. Next, you&apos;ll enter your PIN and the verification code from email.
                </p>
              </div>

              <div className="space-y-1 rounded-xl border border-line bg-gradient-to-b from-canvas-subtle/90 to-white p-4 shadow-sm">
                <Row label="Method" value={intent.method} mono />
                <Row label="Chain id (hex)" value={intent.chainIdHex} mono last />
              </div>

              <Input
                label="Debit card number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="4242424242424242"
                value={cardPanDigits}
                onChange={(e) => setCardPanDigits(e.target.value.replace(/\D/g, "").slice(0, 19))}
                leading={<CreditCard className="h-3.5 w-3.5" />}
              />
              <Input
                label="CVV"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="•••"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                leading={<KeyRound className="h-3.5 w-3.5" />}
              />

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={cancel}>
                  Reject
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void proceedCardStep()}
                  disabled={cardStepBusy}
                >
                  {cardStepBusy ? "Sending signing code…" : "Continue"}
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "pin_otp" && intent ? (
            <div className="space-y-5 nrc-fade-up">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">Authorize</p>
                <h1 className="mt-2 text-[21px] font-semibold tracking-[-0.02em] text-ink">PIN & verification code</h1>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                  Enter your WallCard PIN and the one-time code sent to your email to release this signature.
                </p>
              </div>

              {otpSentHint ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-[12.5px] leading-relaxed text-emerald-950">
                  {otpSentHint}
                </p>
              ) : null}

              <Input
                label="Wallet / card PIN"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                leading={<Lock className="h-3.5 w-3.5" />}
              />
              <Input
                label="Email OTP (6 digits)"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                leading={<Fingerprint className="h-3.5 w-3.5" />}
              />

              {otpEmailsSent >= OTP_MAX_EMAILS_PER_SIGNING_FLOW ? (
                <p className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-center text-[11.5px] leading-relaxed text-amber-950">
                  Maximum verification emails for this attempt ({OTP_MAX_EMAILS_PER_SIGNING_FLOW}). Use{" "}
                  <span className="font-semibold">Back</span>, then Continue again for a fresh limit.
                </p>
              ) : (
                <div className="flex flex-col items-stretch gap-2 sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-[12px]"
                    disabled={!canResendSigningOtp}
                    onClick={() => void handleResendSigningOtp()}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${otpResendBusy ? "animate-spin" : ""}`} />
                    {otpCooldownLeftMs > 0
                      ? `Resend code (${otpCooldownSec}s)`
                      : `Resend code (${OTP_MAX_EMAILS_PER_SIGNING_FLOW - otpEmailsSent} left)`}
                  </Button>
                  <p className="text-center text-[10.5px] leading-snug text-ink-subtle">
                    Up to {OTP_MAX_EMAILS_PER_SIGNING_FLOW} emails per attempt ·{" "}
                    {Math.round(OTP_RESEND_COOLDOWN_MS / 1000)}s between sends
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStage("card_cvv");
                    setSigningBundle(null);
                    setOtp("");
                    setOtpSentHint(null);
                    setOtpEmailsSent(0);
                    setOtpLastSentAt(0);
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void submitSigning()}
                  disabled={pin.length < 4 || otp.length < 6 || !signingBundle}
                >
                  Sign with WallCard
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "signing" ? (
            <div className="space-y-5 text-center nrc-fade-up">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100">
                <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-indigo-200 border-t-indigo-600" />
              </div>
              <p className="text-[18px] font-semibold tracking-tight text-ink">Authorizing signature</p>
              <p className="text-[13px] leading-relaxed text-ink-muted">This usually takes a few seconds.</p>
            </div>
          ) : null}

          {stage === "done" ? (
            <div className="space-y-5 text-center nrc-fade-up">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 ring-1 ring-emerald-100">
                <Check className="h-7 w-7" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-[20px] font-semibold tracking-tight text-ink">Approved</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  Your application will receive the signature automatically.
                </p>
              </div>
              {signatureOut ? (
                <div className="rounded-xl border border-line bg-canvas-subtle/60 p-4 text-left">
                  <Row label="Signature" value={truncate(signatureOut)} mono last />
                </div>
              ) : null}
              <Button variant="secondary" className="w-full" onClick={() => window.close()}>
                Close
              </Button>
            </div>
          ) : null}

          {stage === "error" ? (
            <div className="space-y-5 nrc-fade-up">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-red-600">Blocked</p>
              <p className="rounded-lg border border-red-200 bg-danger-soft px-3 py-2 font-mono text-[12.5px] text-red-700">
                {error}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={cancel}>
                  Close
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setStage(intent ? "pin_otp" : "await_intent")}>
                  Retry
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {!isEmbed ? (
        <p className="text-center text-[11.5px] leading-relaxed text-ink-subtle">
          Use <span className="font-mono text-[11px] text-ink-muted">BrowserProvider</span> (ethers) or{" "}
          <span className="font-mono text-[11px] text-ink-muted">provider.request</span> for Solana — same patterns as extension wallets.
        </p>
      ) : (
        <p className="text-center text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-subtle">WallCard · encrypted session</p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  last
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-line/60"}`}>
      <span className="text-[12.5px] text-ink-muted">{label}</span>
      <span className={`text-[13px] font-medium text-ink truncate max-w-[220px] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function truncate(value: string) {
  if (value.length <= 22) return value;
  return `${value.slice(0, 12)}…${value.slice(-10)}`;
}
