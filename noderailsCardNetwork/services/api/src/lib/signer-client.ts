import { config } from "../config.js";

const signerHost = process.env.SIGNER_HOST_URL ?? "http://localhost:8081";

export async function signerProvision(userId: string): Promise<{
  evmAddress: string;
  solanaAddress: string;
  accountAlias: string;
  evmWalletRef: string;
  solanaWalletRef: string;
}> {
  const res = await fetch(`${signerHost}/provision`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signer-token": config.SIGNER_SHARED_TOKEN
    },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`signer_provision_failed:${detail}`);
  }
  return res.json();
}

function chainIdFromPayload(payload: Record<string, unknown>, explicit?: number): number | undefined {
  if (explicit !== undefined && Number.isInteger(explicit) && explicit > 0) return explicit;
  const raw = payload.chainId;
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return undefined;
}

export async function signerSign(params: {
  userId: string;
  walletRef: string;
  chain: "evm" | "solana";
  method: string;
  payload: Record<string, unknown>;
  chainId?: number;
}): Promise<{ signature: string; signingOutput: Record<string, unknown>; enclavePcrDigest: string; providerTag: string }> {
  const chainId = chainIdFromPayload(params.payload, params.chainId);
  const res = await fetch(`${signerHost}/sign`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signer-token": config.SIGNER_SHARED_TOKEN
    },
    // NOTE: never include pin, card number, or CVV here
    body: JSON.stringify({
      userId: params.userId,
      walletRef: params.walletRef,
      chain: params.chain,
      method: params.method,
      payload: params.payload,
      chainId
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`signer_sign_failed:${detail}`);
  }
  return res.json();
}
