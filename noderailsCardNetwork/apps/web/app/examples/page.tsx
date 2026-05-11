"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Code2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { createNoderailsCardProvider, openWallCardLogin } from "@noderails-card/sdk-core";
import { Badge, Button, Card } from "@noderails-card/ui";

/** Origin for the embedded wallet (Expo web: `apps/mobile` routes `/auth`, `/sign`). Styling is compiled there (`mobile-tailwind.bundle.css`), not from this Next app. */
const walletUrl =
  process.env.NEXT_PUBLIC_WALLCARD_WEB_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_MOBILE_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_WALLET_URL?.trim() ||
  "http://localhost:8090";
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:9080";

type DemoId =
  | "wallet_session"
  | "ethers_sign_message"
  | "personal_sign"
  | "eth_sign"
  | "eth_signTypedData_v4"
  | "eth_sendTransaction"
  | "solana_signMessage"
  | "solana_signTransaction";

const DEMOS: {
  id: DemoId;
  chain: "Session" | "EVM" | "Solana";
  label: string;
  description: string;
  code: string;
}[] = [
  {
    id: "wallet_session",
    chain: "Session",
    label: "Wallet login + accounts",
    description:
      "Try signing in through the embedded wallet—OTP completes here, then we keep the Bearer token and load your linked EVM and Solana addresses for the flows below.",
    code: `const token = await openWallCardLogin({ walletOrigin: WALLET_ORIGIN });
wallcard.setAccessToken(token);
const accounts = await wallcard.request({ method: "eth_requestAccounts" });`,
  },
  {
    id: "ethers_sign_message",
    chain: "EVM",
    label: "ethers v6 · signMessage",
    description:
      "See WallCard behave like other wallets here: ethers v6 wraps the EIP-1193 provider, then signMessage carries the prompts through the iframe.",
    code: `const bp = new BrowserProvider(wallcard as Eip1193Provider);
const signer = await bp.getSigner();
const sig = await signer.signMessage("Hello from WallCard");`,
  },
  {
    id: "personal_sign",
    chain: "EVM",
    label: "personal_sign",
    description: "Try UTF-8 / hex signing end-to-end with provider.request—the wallet handles verification before returning the signature.",
    code: `const bytes = new TextEncoder().encode("hello wallcard");
const hexMsg =
  "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
await wallcard.request({
  method: "personal_sign",
  params: [hexMsg, FROM_ADDR],
});`,
  },
  {
    id: "eth_sign",
    chain: "EVM",
    label: "eth_sign",
    description: "Try the legacy 32-byte hash path so you can see how WallCard answers older integrator expectations.",
    code: `await wallcard.request({
  method: "eth_sign",
  params: [FROM_ADDR, "0x" + "00".repeat(32)],
});`,
  },
  {
    id: "eth_signTypedData_v4",
    chain: "EVM",
    label: "eth_signTypedData_v4",
    description: "See typed-data (EIP-712) signing with a Mail-shaped payload—you’ll notice the iframe step-up before returning the signature.",
    code: `await wallcard.request({
  method: "eth_signTypedData_v4",
  params: [
    FROM_ADDR,
    JSON.stringify({ types: { EIP712Domain: [], Mail: [] }, domain: {}, message: {} }),
  ],
});`,
  },
  {
    id: "eth_sendTransaction",
    chain: "EVM",
    label: "eth_sendTransaction",
    description: "Try a minimal native-transfer-style broadcast so you can watch WallCard assemble, sign, and send the RPC-shaped payload.",
    code: `await wallcard.request({
  method: "eth_sendTransaction",
  params: [{ from: FROM_ADDR, to: TO_ADDR, value: "0x1", data: "0x" }],
});`,
  },
  {
    id: "solana_signMessage",
    chain: "Solana",
    label: "solana_signMessage",
    description:
      "Try UTF-8 message signing on Solana—the iframe walks through session checks before handing back the signature bytes.",
    code: `await wallcard.request({
  method: "solana_signMessage",
  params: [{ message: "Hello Solana · WallCard" }],
});`,
  },
  {
    id: "solana_signTransaction",
    chain: "Solana",
    label: "solana_signTransaction",
    description:
      "See a devnet no-op tx built with @solana/web3.js, serialized to base64, then signed inside WallCard. Start with “Wallet login + accounts” once so Solana linkage is populated.",
    code: `const tx = new Transaction({ feePayer: fromPk, recentBlockhash }).add(
  SystemProgram.transfer({ fromPubkey: fromPk, toPubkey: fromPk, lamports: 0 })
);
const b64 = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString("base64");
await wallcard.request({
  method: "solana_signTransaction",
  params: [{ serializedTransactionBase64: b64, from: SOL_ADDR }],
});`,
  },
];

function utf8ToHex0x(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function u8ToBase64(u8: Uint8Array): string {
  let binary = "";
  u8.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return globalThis.btoa(binary);
}

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export default function ExamplesPage() {
  const wallcard = useMemo(
    () =>
      createNoderailsCardProvider({
        environment: "development",
        mode: "iframe",
        walletOrigin: walletUrl,
        apiBaseUrl: apiUrl,
      }),
    []
  );

  const [active, setActive] = useState<DemoId>("ethers_sign_message");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [lastErr, setLastErr] = useState<string | null>(null);

  const push = useCallback((line: string) => {
    setLogs((prev) => [...prev, `${ts()}  ${line}`]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setLastOk(null);
    setLastErr(null);
  }, []);

  const activeMeta = DEMOS.find((d) => d.id === active)!;

  const seeInAction = useCallback(async () => {
    setBusy(true);
    setLastErr(null);
    setLastOk(null);
    push(`→ ${activeMeta.label}`);

    try {
      let summary = "";

      if (active === "wallet_session") {
        const token = await openWallCardLogin({ walletOrigin: walletUrl });
        wallcard.setAccessToken(token);
        const accounts = (await wallcard.request({ method: "eth_requestAccounts" })) as string[];
        const linked = wallcard.getLinkedAddresses();
        summary = `Session OK · EVM ${accounts[0]?.slice(0, 12)}… · SOL ${linked.sol ? `${linked.sol.slice(0, 8)}…` : "(none)"}`;
        push(summary);
      } else if (active === "ethers_sign_message") {
        const bp = new BrowserProvider(wallcard as Eip1193Provider);
        const signer = await bp.getSigner();
        const sig = await signer.signMessage("Hello from WallCard · ethers v6");
        summary = `signature ${sig.slice(0, 16)}…${sig.slice(-10)}`;
        push(`ethers.signMessage → ${summary}`);
      } else if (active === "personal_sign") {
        await wallcard.refreshWalletAccounts();
        const { evm } = wallcard.getLinkedAddresses();
        const from = evm || "0x0000000000000000000000000000000000000001";
        const hexMsg = utf8ToHex0x("hello wallcard");
        const out = await wallcard.request({
          method: "personal_sign",
          params: [hexMsg, from],
        });
        const s = typeof out === "string" ? out : JSON.stringify(out);
        summary = s.length > 56 ? `${s.slice(0, 28)}…${s.slice(-12)}` : s;
        push(`personal_sign → ${summary}`);
      } else if (active === "eth_sign") {
        await wallcard.refreshWalletAccounts();
        const { evm } = wallcard.getLinkedAddresses();
        const from = evm || "0x0000000000000000000000000000000000000001";
        const out = await wallcard.request({
          method: "eth_sign",
          params: [from, `0x${"ab".repeat(32)}`],
        });
        const s = typeof out === "string" ? out : JSON.stringify(out);
        summary = s.length > 56 ? `${s.slice(0, 28)}…${s.slice(-12)}` : s;
        push(`eth_sign → ${summary}`);
      } else if (active === "eth_signTypedData_v4") {
        await wallcard.refreshWalletAccounts();
        const { evm } = wallcard.getLinkedAddresses();
        const from = evm || "0x0000000000000000000000000000000000000001";
        const typed = JSON.stringify({
          types: {
            EIP712Domain: [
              { name: "name", type: "string" },
              { name: "version", type: "string" },
              { name: "chainId", type: "uint256" },
            ],
            Mail: [
              { name: "from", type: "string" },
              { name: "to", type: "string" },
            ],
          },
          primaryType: "Mail",
          domain: { name: "WallCard", version: "1", chainId: 1 },
          message: { from: "alice", to: "bob" },
        });
        const out = await wallcard.request({
          method: "eth_signTypedData_v4",
          params: [from, typed],
        });
        const s = typeof out === "string" ? out : JSON.stringify(out);
        summary = s.length > 64 ? `${s.slice(0, 32)}…` : s;
        push(`eth_signTypedData_v4 → ${summary}`);
      } else if (active === "eth_sendTransaction") {
        await wallcard.refreshWalletAccounts();
        const { evm } = wallcard.getLinkedAddresses();
        const from = evm || "0x0000000000000000000000000000000000000001";
        const out = await wallcard.request({
          method: "eth_sendTransaction",
          params: [{ from, to: from, value: "0x1", data: "0x" }],
        });
        const s = typeof out === "string" ? out : JSON.stringify(out);
        summary = s.length > 66 ? `${s.slice(0, 34)}…` : s;
        push(`eth_sendTransaction → ${summary}`);
      } else if (active === "solana_signMessage") {
        const out = await wallcard.request({
          method: "solana_signMessage",
          params: [{ message: "Hello Solana · WallCard" }],
        });
        const s = typeof out === "string" ? out : JSON.stringify(out);
        summary = s.length > 48 ? `${s.slice(0, 24)}…` : s;
        push(`solana_signMessage → ${summary}`);
      } else if (active === "solana_signTransaction") {
        await wallcard.refreshWalletAccounts();
        const { sol } = wallcard.getLinkedAddresses();
        if (!sol) {
          throw new Error(
            "Linked Solana address missing. Run “Wallet login + accounts” first so this page can serialize a tx with your fee payer."
          );
        }
        const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
        const recent = await conn.getLatestBlockhash();
        const fromPk = new PublicKey(sol);
        const ix = SystemProgram.transfer({
          fromPubkey: fromPk,
          toPubkey: fromPk,
          lamports: 0,
        });
        const tx = new Transaction({
          feePayer: fromPk,
          recentBlockhash: recent.blockhash,
        }).add(ix);
        const wire = tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
        const b64 = u8ToBase64(wire);
        const out = await wallcard.request({
          method: "solana_signTransaction",
          params: [{ serializedTransactionBase64: b64, from: sol }],
        });
        const s = typeof out === "string" ? out : JSON.stringify(out);
        summary = s.length > 56 ? `${s.slice(0, 28)}…${s.slice(-10)}` : s;
        push(`solana_signTransaction → ${summary}`);
      }

      setLastOk(summary || "done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastErr(msg);
      push(`ERROR: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [active, activeMeta.label, push, wallcard]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Home
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-brand">
            Try WallCard
          </p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.02em] text-ink">
            See how it works in action
          </h1>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-muted">
            Pick any flow below, skim the snippet, then use{" "}
            <span className="font-medium text-ink">See in action</span>
            {" "}
            to walk through signing with{" "}
            <span className="font-medium text-ink">@noderails-card/sdk-core</span>
            . The iframe talks to{" "}
            <span className="font-mono text-[13px] text-ink">{walletUrl}</span>
            {" "}while the API backing it lives at{" "}
            <span className="font-mono text-[13px] text-ink">{apiUrl}</span>
            —same card prompts, PIN, and email OTP you would show someone evaluating WallCard.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <Badge tone="violet" className="shrink-0 border-violet-400/30 bg-violet-500/10">
            <Code2 className="h-3 w-3" /> iframe · EIP-1193
          </Badge>
          <Link
            href="/checkout"
            className="text-[12.5px] font-semibold text-brand underline underline-offset-2 hover:text-ink"
          >
            Card checkout · try it →
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="p-2">
          <ul className="space-y-1">
            {DEMOS.map((m) => {
              const isActive = active === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setActive(m.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-brand-soft text-brand-ink"
                        : "text-ink-muted hover:bg-canvas-muted hover:text-ink"
                    }`}
                  >
                    <span>
                      <span className="block font-mono text-[12.5px] font-semibold">{m.label}</span>
                      <span className="block text-[11px] text-ink-subtle">{m.chain}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden p-0 shadow-[var(--shadow-card-lg)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-gradient-to-r from-violet-500/[0.06] via-canvas-subtle to-emerald-500/[0.05] px-5 py-4">
              <div>
                <p className="font-mono text-[15px] font-semibold text-ink">{activeMeta.label}</p>
                <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink-muted">
                  {activeMeta.description}
                </p>
              </div>
              <Badge tone={activeMeta.chain === "Solana" ? "success" : activeMeta.chain === "Session" ? "neutral" : "brand"}>
                {activeMeta.chain}
              </Badge>
            </div>

            <div className="border-b border-line bg-[#0b0b12] px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Code running</p>
              <pre className="mt-2 max-h-[240px] overflow-auto font-mono text-[11.5px] leading-relaxed text-zinc-200">
                <code>{activeMeta.code}</code>
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              <Button variant="secondary" onClick={() => void seeInAction()} disabled={busy} className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                {busy ? "Running…" : "See in action"}
              </Button>
              <Button variant="outline" type="button" onClick={clearLogs} disabled={!logs.length && !lastErr && !lastOk}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear log
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/80 px-4 py-2.5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Activity log</p>
                <span className="font-mono text-[10px] text-ink-subtle">{logs.length} lines</span>
              </div>
              <pre className="max-h-[280px] min-h-[160px] overflow-auto bg-[#0b0b12] p-4 font-mono text-[11px] leading-relaxed text-emerald-300/95">
                <code>{logs.length ? logs.join("\n") : "// Press “See in action” above to watch WallCard respond — lines stream in here"}</code>
              </pre>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/80 px-4 py-2.5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Last result</p>
                {lastErr ? (
                  <Badge tone="danger">Error</Badge>
                ) : lastOk ? (
                  <Badge tone="success">OK</Badge>
                ) : (
                  <Badge tone="neutral">Idle</Badge>
                )}
              </div>
              <div className="min-h-[160px] bg-canvas-subtle/40 p-4">
                {lastErr ? (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-red-600 dark:text-red-400">
                    {lastErr}
                  </pre>
                ) : lastOk ? (
                  <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink">
                    {lastOk}
                  </pre>
                ) : (
                  <p className="text-[13px] text-ink-muted">
                    Finished runs summarize what WallCard returned; anything that fails surfaces in red so you can see what blocked the flow.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Install</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0b0b12] px-4 py-3 font-mono text-[12.5px] text-zinc-200">
              <code>pnpm add @noderails-card/sdk-core ethers @solana/web3.js</code>
            </pre>
            <p className="mt-5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Bootstrap (iframe)
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas-muted px-4 py-3 font-mono text-[12px] leading-relaxed text-ink">
              <code>{`const wallcard = createNoderailsCardProvider({
  environment: "development",
  mode: "iframe",
  walletOrigin: "${walletUrl}",
  apiBaseUrl: "${apiUrl}",
});`}</code>
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
