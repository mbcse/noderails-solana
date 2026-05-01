/** Normalize EIP-1193 `params` (array or object) into a flat record for WallCard API payloads. */
export function normalizeWalletRpcParams(method: string, raw?: unknown[] | Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw)) {
    switch (method) {
      case "personal_sign":
        return { message: raw[0], from: raw[1] };
      case "eth_sign":
        return { hash: raw[0], from: raw[1] };
      case "eth_signTypedData_v4":
        return { from: raw[0], typedData: raw[1] };
      case "eth_sendTransaction":
      case "eth_signTransaction": {
        const tx = asRecord(raw[0]);
        return { ...(tx ?? {}) };
      }
      case "solana_signMessage":
        return typeof raw[0] === "object" && raw[0] !== null && !Array.isArray(raw[0])
          ? asRecord(raw[0]) ?? {}
          : { message: raw[0], from: raw[1] };
      case "solana_signTransaction":
        return typeof raw[0] === "object" && raw[0] !== null && !Array.isArray(raw[0])
          ? asRecord(raw[0]) ?? {}
          : { serializedTransactionBase64: raw[0], from: raw[1] };
      default:
        return {};
    }
  }
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function parseChainIdFromHex(hex: string): number {
  const n = Number.parseInt(hex.replace(/^0x/i, ""), 16);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Build `{ chain, method, payload }` for `POST /v1/signing-requests` from an EIP-1193 / SDK intent.
 */
export function buildWallCardSigningPayload(input: {
  method: string;
  params?: unknown[] | Record<string, unknown>;
  chainIdHex: string;
  evmAddress: string;
  solAddress: string;
}): { chain: "evm" | "solana"; method: string; payload: Record<string, unknown> } {
  const chainId = parseChainIdFromHex(input.chainIdHex);
  const p = normalizeWalletRpcParams(input.method, input.params);

  if (input.method.startsWith("solana_")) {
    const from = String(p.from || input.solAddress || "");
    if (!from) throw new Error("missing_solana_address");
    if (input.method === "solana_signMessage") {
      return {
        chain: "solana",
        method: "solana_signMessage",
        payload: {
          from,
          message: String(p.message ?? ""),
          chainId
        }
      };
    }
    if (input.method === "solana_signTransaction") {
      const wire = String(p.serializedTransactionBase64 ?? p.transaction ?? "");
      if (!wire) throw new Error("missing_serialized_solana_transaction");
      return {
        chain: "solana",
        method: "solana_signTransaction",
        payload: { from, serializedTransactionBase64: wire, chainId }
      };
    }
    throw new Error(`unsupported_solana_method:${input.method}`);
  }

  const from = String(p.from || input.evmAddress || "");
  if (!from) throw new Error("missing_evm_address");

  switch (input.method) {
    case "personal_sign":
      return {
        chain: "evm",
        method: "personal_sign",
        payload: {
          from,
          message: String(p.message ?? ""),
          chainId
        }
      };
    case "eth_sign":
      return {
        chain: "evm",
        method: "eth_sign",
        payload: {
          from,
          hash: String(p.hash ?? ""),
          chainId
        }
      };
    case "eth_signTypedData_v4": {
      let typed: unknown = p.typedData ?? p;
      if (typeof typed === "string") typed = JSON.parse(typed) as unknown;
      const tr = asRecord(typed);
      if (!tr) throw new Error("invalid_typed_data");
      return {
        chain: "evm",
        method: "eth_signTypedData_v4",
        payload: {
          from,
          typedData: tr,
          chainId
        }
      };
    }
    case "eth_signTransaction":
    case "eth_sendTransaction": {
      const tx = p;
      const txChain =
        typeof tx.chainId === "string"
          ? parseChainIdFromHex(tx.chainId)
          : typeof tx.chainId === "number"
            ? tx.chainId
            : chainId;
      return {
        chain: "evm",
        method: input.method,
        payload: {
          from,
          chainId: txChain,
          nonce: tx.nonce ?? 0,
          to: tx.to ?? from,
          value: tx.value ?? "0",
          data: tx.data ?? "0x",
          gas: tx.gas ?? tx.gasLimit ?? 21000,
          gasPrice: tx.gasPrice ?? 1_000_000_000,
          ...(tx.maxFeePerGas !== undefined ? { maxFeePerGas: tx.maxFeePerGas } : {}),
          ...(tx.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: tx.maxPriorityFeePerGas } : {})
        }
      };
    }
    default:
      throw new Error(`unsupported_method:${input.method}`);
  }
}
