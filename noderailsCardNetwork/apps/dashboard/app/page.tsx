"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock3,
  KeyRound,
  Plus,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import { Badge, Button, Card, Input, Stat } from "@noderails-card/ui";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9080";
const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3300";

const recentRequests = [
  {
    id: "req_4f29c1",
    method: "personal_sign",
    chain: "EVM",
    merchant: "Acme Marketplace",
    status: "Signed",
    tone: "success" as const,
    when: "2m ago",
    latency: "312ms"
  },
  {
    id: "req_8b3a72",
    method: "eth_sendTransaction",
    chain: "EVM",
    merchant: "Acme Marketplace",
    status: "Pending",
    tone: "warning" as const,
    when: "4m ago",
    latency: "-"
  },
  {
    id: "req_1c0d44",
    method: "solana_signTransaction",
    chain: "SOL",
    merchant: "Sundial Swap",
    status: "Signed",
    tone: "success" as const,
    when: "11m ago",
    latency: "284ms"
  },
  {
    id: "req_2e7f91",
    method: "eth_signTypedData_v4",
    chain: "EVM",
    merchant: "Beam Protocol",
    status: "Signed",
    tone: "success" as const,
    when: "23m ago",
    latency: "299ms"
  },
  {
    id: "req_9d4a02",
    method: "personal_sign",
    chain: "EVM",
    merchant: "Acme Marketplace",
    status: "Rejected",
    tone: "danger" as const,
    when: "31m ago",
    latency: "-"
  }
];

const merchants = [
  { name: "Acme Marketplace", origin: "https://acme.app", chain: "EVM", today: "8,241" },
  { name: "Sundial Swap", origin: "https://sundial.fi", chain: "SOL", today: "2,189" },
  { name: "Beam Protocol", origin: "https://beam.xyz", chain: "EVM", today: "1,471" },
  { name: "Tundra Vaults", origin: "https://tundra.cash", chain: "EVM", today: "582" }
];

type ChainRow = {
  key: string;
  name: string;
  symbol: string;
  family: "evm" | "solana";
  rpcUrl: string;
  explorerUrl?: string | null;
  isEnabled: boolean;
};
type ChainHealthRow = {
  key: string;
  name: string;
  family: "evm" | "solana";
  rpcUrl: string;
  ok: boolean;
  blockNumber?: string;
  slot?: number;
  error?: string;
};
type TokenRow = {
  id: string;
  chainKey: string;
  symbol: string;
  kind: "erc20" | "spl";
  contractAddress: string;
  decimals: number | null;
  isEnabled: boolean;
};

export default function DashboardOverview() {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [response, setResponse] = useState("");
  const [chainKey, setChainKey] = useState("");
  const [chainName, setChainName] = useState("");
  const [chainSymbol, setChainSymbol] = useState("");
  const [chainRpcUrl, setChainRpcUrl] = useState("");
  const [chainFamily, setChainFamily] = useState<"evm" | "solana">("evm");
  const [chainResponse, setChainResponse] = useState("");
  const [chains, setChains] = useState<ChainRow[]>([]);
  const [chainHealth, setChainHealth] = useState<ChainHealthRow[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [tokenChainKey, setTokenChainKey] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenKind, setTokenKind] = useState<"erc20" | "spl">("erc20");
  const [tokenContract, setTokenContract] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("");
  const [tokenResponse, setTokenResponse] = useState("");

  useEffect(() => {
    if (!token) return;
    void refreshChains();
    void refreshTokens();
  }, [token]);

  const register = async () => {
    setSubmitting(true);
    setResponse("");
    try {
      const res = await fetch(`${apiBase}/v1/dapps`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ name, origin })
      });
      setResponse(JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setResponse(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }, null, 2));
    } finally {
      setSubmitting(false);
    }
  };

  const seedChains = async () => {
    if (!token) return;
    setSubmitting(true);
    setChainResponse("");
    try {
      const res = await fetch(`${apiBase}/v1/chains/seed`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        }
      });
      setChainResponse(JSON.stringify(await res.json(), null, 2));
      await refreshChains();
      await refreshTokens();
    } catch (e) {
      setChainResponse(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }, null, 2));
    } finally {
      setSubmitting(false);
    }
  };

  const createChain = async () => {
    if (!token || !chainKey || !chainName || !chainSymbol || !chainRpcUrl) return;
    setSubmitting(true);
    setChainResponse("");
    try {
      const res = await fetch(`${apiBase}/v1/chains`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          key: chainKey,
          name: chainName,
          symbol: chainSymbol,
          family: chainFamily,
          rpcUrl: chainRpcUrl
        })
      });
      setChainResponse(JSON.stringify(await res.json(), null, 2));
      await refreshChains();
      await refreshTokens();
      setChainKey("");
      setChainName("");
      setChainSymbol("");
      setChainRpcUrl("");
    } catch (e) {
      setChainResponse(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }, null, 2));
    } finally {
      setSubmitting(false);
    }
  };

  const refreshChains = async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/v1/chains`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await res.json();
    if (res.ok) {
      setChains(body.data ?? []);
    }
  };

  const patchChain = async (key: string, patch: Partial<ChainRow>) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/v1/chains/${key}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify(patch)
      });
      setChainResponse(JSON.stringify(await res.json(), null, 2));
      await refreshChains();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteChain = async (key: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/v1/chains/${key}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() }
      });
      setChainResponse(JSON.stringify(await res.json(), null, 2));
      await refreshChains();
    } finally {
      setSubmitting(false);
    }
  };

  const refreshChainHealth = async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/v1/chains/health`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await res.json();
    if (res.ok) {
      setChainHealth(body.data ?? []);
    } else {
      setChainResponse(JSON.stringify(body, null, 2));
    }
  };

  const refreshTokens = async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/v1/tokens`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await res.json();
    if (res.ok) {
      setTokens(body.data ?? []);
    }
  };

  const seedTokens = async () => {
    if (!token) return;
    setSubmitting(true);
    setTokenResponse("");
    try {
      const res = await fetch(`${apiBase}/v1/tokens/seed`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        }
      });
      setTokenResponse(JSON.stringify(await res.json(), null, 2));
      await refreshTokens();
    } catch (e) {
      setTokenResponse(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }, null, 2));
    } finally {
      setSubmitting(false);
    }
  };

  const createToken = async () => {
    if (!token || !tokenChainKey || !tokenSymbol || !tokenContract) return;
    setSubmitting(true);
    setTokenResponse("");
    try {
      const decimalsNum = tokenDecimals.trim() === "" ? undefined : Number(tokenDecimals);
      const res = await fetch(`${apiBase}/v1/tokens`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          chainKey: tokenChainKey,
          symbol: tokenSymbol,
          kind: tokenKind,
          contractAddress: tokenContract,
          ...(decimalsNum !== undefined && !Number.isNaN(decimalsNum) ? { decimals: decimalsNum } : {})
        })
      });
      setTokenResponse(JSON.stringify(await res.json(), null, 2));
      await refreshTokens();
      setTokenSymbol("");
      setTokenContract("");
      setTokenDecimals("");
    } catch (e) {
      setTokenResponse(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }, null, 2));
    } finally {
      setSubmitting(false);
    }
  };

  const patchToken = async (id: string, patch: Partial<Pick<TokenRow, "isEnabled" | "symbol" | "decimals">>) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/v1/tokens/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify(patch)
      });
      setTokenResponse(JSON.stringify(await res.json(), null, 2));
      await refreshTokens();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteToken = async (id: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/v1/tokens/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() }
      });
      setTokenResponse(JSON.stringify(await res.json(), null, 2));
      await refreshTokens();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Greeting ──────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-brand">
            Overview
          </p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.02em] text-ink">
            Good evening, Acme
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">
            Here&apos;s payment and authorization activity across your program in the last 24 hours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`${webUrl}/docs`}>API reference</a>
          </Button>
          <Button size="sm" variant="secondary">
            <Plus className="h-3.5 w-3.5" />
            New merchant
          </Button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Authorization volume · 24h"
          value="12,483"
          delta="+18.2%"
          trend="up"
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Approval rate"
          value="99.4%"
          delta="+0.3pt"
          trend="up"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Avg confirmation"
          value="312ms"
          delta="-22ms"
          trend="up"
          icon={<Clock3 className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Active merchants"
          value="8"
          delta="+1"
          trend="up"
          icon={<Wallet className="h-3.5 w-3.5" />}
        />
      </div>

      {/* ── Chart + merchants ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12.5px] font-medium text-ink-muted">Authorization volume</p>
              <p className="mt-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">
                12,483 requests
              </p>
              <p className="mt-1 text-[12.5px] text-emerald-600">↑ 18.2% vs last 7d</p>
            </div>
            <Badge tone="brand">EVM + SOL</Badge>
          </div>
          <Chart className="mt-5 h-56 w-full" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-ink-subtle">
            {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "now"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line p-5">
            <p className="text-[14px] font-semibold text-ink">Top merchants</p>
            <Badge tone="neutral">{merchants.length}</Badge>
          </div>
          <ul className="divide-y divide-line/80">
            {merchants.map((d) => (
              <li key={d.name} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-ink">{d.name}</p>
                  <p className="truncate font-mono text-[11.5px] text-ink-subtle">{d.origin}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-ink">{d.today}</p>
                  <Badge tone={d.chain === "SOL" ? "violet" : "brand"} className="mt-0.5 text-[10.5px]">
                    {d.chain}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ── Recent activity table ─────────────── */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-line p-5">
          <div>
            <p className="text-[14px] font-semibold text-ink">Recent authorizations</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Card + step-up auth audit trail
            </p>
          </div>
          <Button size="sm" variant="outline">
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-canvas-subtle/70 text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
              <tr>
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Merchant</th>
                <th className="px-5 py-3">Latency</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/80">
              {recentRequests.map((r) => (
                <tr key={r.id} className="hover:bg-canvas-subtle/60">
                  <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink">{r.id}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[12.5px] text-ink">{r.method}</span>
                    <Badge
                      tone={r.chain === "SOL" ? "violet" : "brand"}
                      className="ml-2 text-[10.5px]"
                    >
                      {r.chain}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">{r.merchant}</td>
                  <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink-muted">
                    {r.latency}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={r.tone}>{r.status}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink-muted">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Register merchant terminal ───────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <Plus className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-[14.5px] font-semibold text-ink">Register a merchant terminal</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Legacy path: lock the HTTPS origin that calls our APIs. Primary checkout is card number, CVV, PIN + OTP.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input
              label="Bearer token"
              placeholder="JWT from /auth"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              leading={<KeyRound className="h-3.5 w-3.5" />}
            />
            <Input
              label="Merchant display name"
              placeholder="Acme Marketplace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leading={<Sparkles className="h-3.5 w-3.5" />}
            />
            <div className="sm:col-span-2">
              <Input
                label="Allowed origin"
                placeholder="https://app.example.com"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                leading={<ShieldCheck className="h-3.5 w-3.5" />}
                hint="HTTPS only. Wildcards are rejected by the API."
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setResponse("")}>
              Clear
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={register}
              disabled={submitting || !token || !name || !origin}
            >
              {submitting ? "Saving…" : "Register merchant"}
            </Button>
          </div>

          {response ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/70 px-4 py-2.5">
                <p className="text-[12.5px] font-medium text-ink-muted">API response</p>
                <Badge tone="success">200</Badge>
              </div>
              <pre className="overflow-x-auto bg-[#0b0b12] p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200">
                <code>{response}</code>
              </pre>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <p className="text-[14px] font-semibold text-ink">Security checklist</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Review before going live with a partner.
          </p>
          <ul className="mt-5 space-y-3">
            {[
              { label: "Pin allowlisted origins (HTTPS)", done: true },
              { label: "Enable webhook HMAC signing", done: true },
              { label: "Set rate limit per merchant terminal", done: true },
              { label: "Promote signer to Nitro mode", done: false },
              { label: "Configure KMS attestation policy", done: false }
            ].map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    c.done
                      ? "bg-emerald-100 text-emerald-600"
                      : "border border-dashed border-line-strong text-ink-subtle"
                  }`}
                >
                  {c.done ? <CheckCircle2 className="h-3 w-3" /> : null}
                </span>
                <span className={c.done ? "text-ink" : "text-ink-muted"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-[14.5px] font-semibold text-ink">Chain registry (extensible balances)</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Add or seed chains so wallet balances can scale beyond Ethereum and Solana without code rewrites.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input label="Chain key" placeholder="base-mainnet" value={chainKey} onChange={(e) => setChainKey(e.target.value)} />
            <Input label="Display name" placeholder="Base" value={chainName} onChange={(e) => setChainName(e.target.value)} />
            <Input label="Symbol" placeholder="ETH" value={chainSymbol} onChange={(e) => setChainSymbol(e.target.value)} />
            <Input label="Family (evm/solana)" placeholder="evm" value={chainFamily} onChange={(e) => setChainFamily(e.target.value === "solana" ? "solana" : "evm")} />
            <div className="sm:col-span-2">
              <Input label="RPC URL" placeholder="https://..." value={chainRpcUrl} onChange={(e) => setChainRpcUrl(e.target.value)} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={seedChains} disabled={submitting || !token}>
              Seed default chains
            </Button>
            <Button variant="outline" size="sm" onClick={refreshChains} disabled={submitting || !token}>
              Refresh list
            </Button>
            <Button variant="outline" size="sm" onClick={refreshChainHealth} disabled={submitting || !token}>
              Check health
            </Button>
            <Button variant="secondary" size="sm" onClick={createChain} disabled={submitting || !token}>
              {submitting ? "Saving..." : "Create chain"}
            </Button>
          </div>

          {chainResponse ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/70 px-4 py-2.5">
                <p className="text-[12.5px] font-medium text-ink-muted">Chain API response</p>
                <Badge tone="brand">JSON</Badge>
              </div>
              <pre className="overflow-x-auto bg-[#0b0b12] p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200">
                <code>{chainResponse}</code>
              </pre>
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/70 px-4 py-2.5">
              <p className="text-[12.5px] font-medium text-ink-muted">Configured chains</p>
              <Badge tone="neutral">{chains.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-canvas-subtle/40 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  <tr>
                    <th className="px-4 py-2">Key</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Family</th>
                    <th className="px-4 py-2">RPC</th>
                    <th className="px-4 py-2">Enabled</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {chains.map((c) => (
                    <tr key={c.key}>
                      <td className="px-4 py-2 font-mono text-ink">{c.key}</td>
                      <td className="px-4 py-2 text-ink">
                        {editingKey === c.key ? (
                          <input
                            className="w-full rounded border border-line bg-canvas px-2 py-1 text-[12px] text-ink"
                            defaultValue={c.name}
                            onBlur={(e) => {
                              void patchChain(c.key, { name: e.target.value });
                              setEditingKey(null);
                            }}
                          />
                        ) : (
                          <button className="text-left hover:text-brand" onClick={() => setEditingKey(c.key)}>
                            {c.name} ({c.symbol})
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={c.family === "solana" ? "violet" : "brand"}>{c.family.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-[11.5px] text-ink-muted">{c.rpcUrl}</td>
                      <td className="px-4 py-2">
                        <Button
                          variant={c.isEnabled ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => void patchChain(c.key, { isEnabled: !c.isEnabled })}
                          disabled={submitting}
                        >
                          {c.isEnabled ? "Enabled" : "Disabled"}
                        </Button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => void deleteChain(c.key)} disabled={submitting}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!chains.length ? (
                    <tr>
                      <td className="px-4 py-3 text-ink-subtle" colSpan={6}>
                        No chains configured yet. Seed defaults or create one above.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/70 px-4 py-2.5">
              <p className="text-[12.5px] font-medium text-ink-muted">Chain RPC health</p>
              <Badge tone="neutral">{chainHealth.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-canvas-subtle/40 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  <tr>
                    <th className="px-4 py-2">Chain</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Head</th>
                    <th className="px-4 py-2">RPC URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {chainHealth.map((h) => (
                    <tr key={h.key}>
                      <td className="px-4 py-2 text-ink">
                        {h.name} <span className="font-mono text-ink-subtle">({h.key})</span>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={h.ok ? "success" : "danger"}>{h.ok ? "Healthy" : "Error"}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-ink-muted">{h.blockNumber ?? h.slot ?? h.error ?? "-"}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-ink-subtle">{h.rpcUrl}</td>
                    </tr>
                  ))}
                  {!chainHealth.length ? (
                    <tr>
                      <td className="px-4 py-3 text-ink-subtle" colSpan={4}>
                        No health data yet. Click "Check health".
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-[14.5px] font-semibold text-ink">Token registry (per-chain assets)</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Wallet balance responses include these ERC-20 and SPL mints. Chain seed also seeds default USDC rows when chains exist.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Chain</label>
              <select
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-[13px] text-ink"
                value={tokenChainKey}
                onChange={(e) => setTokenChainKey(e.target.value)}
              >
                <option value="">Select chain key</option>
                {chains.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} ({c.key})
                  </option>
                ))}
              </select>
            </div>
            <Input label="Symbol" placeholder="USDC" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Kind</label>
              <select
                className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-[13px] text-ink"
                value={tokenKind}
                onChange={(e) => setTokenKind(e.target.value === "spl" ? "spl" : "erc20")}
              >
                <option value="erc20">erc20 (EVM)</option>
                <option value="spl">spl (Solana)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Contract / mint address"
                placeholder="0x… or Solana mint"
                value={tokenContract}
                onChange={(e) => setTokenContract(e.target.value)}
              />
            </div>
            <Input
              label="Decimals (optional)"
              placeholder="6"
              value={tokenDecimals}
              onChange={(e) => setTokenDecimals(e.target.value)}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={seedTokens} disabled={submitting || !token}>
              Seed default tokens
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshTokens()} disabled={submitting || !token}>
              Refresh list
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={createToken}
              disabled={submitting || !token || !tokenChainKey || !tokenSymbol || !tokenContract}
            >
              {submitting ? "Saving..." : "Add token"}
            </Button>
          </div>

          {tokenResponse ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/70 px-4 py-2.5">
                <p className="text-[12.5px] font-medium text-ink-muted">Token API response</p>
                <Badge tone="brand">JSON</Badge>
              </div>
              <pre className="overflow-x-auto bg-[#0b0b12] p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200">
                <code>{tokenResponse}</code>
              </pre>
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-canvas-subtle/70 px-4 py-2.5">
              <p className="text-[12.5px] font-medium text-ink-muted">Configured tokens</p>
              <Badge tone="neutral">{tokens.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-canvas-subtle/40 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                  <tr>
                    <th className="px-4 py-2">Chain</th>
                    <th className="px-4 py-2">Symbol</th>
                    <th className="px-4 py-2">Kind</th>
                    <th className="px-4 py-2">Contract</th>
                    <th className="px-4 py-2">Decimals</th>
                    <th className="px-4 py-2">Enabled</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/80">
                  {tokens.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2 font-mono text-[11.5px] text-ink">{t.chainKey}</td>
                      <td className="px-4 py-2 text-ink">{t.symbol}</td>
                      <td className="px-4 py-2">
                        <Badge tone={t.kind === "spl" ? "violet" : "brand"}>{t.kind}</Badge>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2 font-mono text-[11px] text-ink-muted" title={t.contractAddress}>
                        {t.contractAddress}
                      </td>
                      <td className="px-4 py-2 font-mono text-ink-muted">{t.decimals ?? "-"}</td>
                      <td className="px-4 py-2">
                        <Button
                          variant={t.isEnabled ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => void patchToken(t.id, { isEnabled: !t.isEnabled })}
                          disabled={submitting}
                        >
                          {t.isEnabled ? "Enabled" : "Disabled"}
                        </Button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => void deleteToken(t.id)} disabled={submitting}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!tokens.length ? (
                    <tr>
                      <td className="px-4 py-3 text-ink-subtle" colSpan={7}>
                        No tokens yet. Seed defaults (after chains) or add one above.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Chart ─────────────────────────────────────── */
function Chart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 720 220" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="dashGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dashGrad2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[40, 90, 140, 190].map((y) => (
        <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#f4f4f5" strokeWidth="1" />
      ))}
      {/* Filled area (volume) */}
      <path
        d="M0,170 C40,160 80,130 120,128 C160,126 200,170 240,162 C280,154 320,118 360,108 C400,98 440,150 480,142 C520,134 560,84 600,82 C640,80 680,98 720,86 L720,220 L0,220 Z"
        fill="url(#dashGrad)"
      />
      {/* Stroke */}
      <path
        d="M0,170 C40,160 80,130 120,128 C160,126 200,170 240,162 C280,154 320,118 360,108 C400,98 440,150 480,142 C520,134 560,84 600,82 C640,80 680,98 720,86"
        fill="none"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Secondary line (avg latency proxy) */}
      <path
        d="M0,140 C50,130 100,150 160,138 C220,126 270,160 320,150 C380,140 420,160 480,148 C540,136 580,140 640,128 C680,118 700,124 720,120"
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        strokeDasharray="3 4"
      />
      {/* End dot */}
      <circle cx="720" cy="86" r="4" fill="#6366f1" />
      <circle cx="720" cy="86" r="9" fill="#6366f1" fillOpacity="0.18" />
    </svg>
  );
}
