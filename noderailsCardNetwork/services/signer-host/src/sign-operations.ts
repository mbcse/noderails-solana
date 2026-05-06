import type { SigningMethod } from "@noderails-card/common";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { hexToBytes, keccak256, getAddress, type Address, type Hex, type TransactionSerializable } from "viem";
import { privateKeyToAccount, signMessage, signTypedData, signTransaction } from "viem/accounts";
import type { TypedDataDefinition } from "viem";
import { deriveEvmPrivateKey, deriveSolanaSeed } from "./derive-keys.js";

function requirePayloadField<T>(payload: Record<string, unknown>, key: string, code: string): T {
  if (!(key in payload)) throw new Error(code);
  return payload[key] as T;
}

function assertSameEvmFrom(payload: Record<string, unknown>, wallet: Address) {
  const from = getAddress(
    String(requirePayloadField(payload, "from", "evm.requires_from_matching_derived_wallcard_wallet")) as Address
  );
  if (getAddress(from).toLowerCase() !== getAddress(wallet).toLowerCase()) {
    throw new Error("payload.from_must_match_derived_wallcard_wallet");
  }
}

function assertSameSolPubkey(payload: Record<string, unknown>, base58Pk: string) {
  const from = String(requirePayloadField(payload, "from", "solana.requires_from_matching_derived_pubkey"));
  if (from !== base58Pk) throw new Error("payload.from_must_match_derived_solana_pubkey");
}

function coerceBig(v: unknown, field: string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("0x")) return BigInt(t);
    if (/^-?\d+$/.test(t)) return BigInt(t);
  }
  throw new Error(`invalid_bigint_field:${field}`);
}

function coerceOptionalBig(v: unknown, field: string): bigint | undefined {
  if (v === undefined || v === null) return undefined;
  return coerceBig(v, field);
}

/** eth_sign(signing-address, opaque32_hex): ECDSA on keccak(concat(eth prefix UTF-8, opaque32 raw bytes)). */
function ethSignEthereumMessageDigest(opaque32: Hex): Hex {
  const prefix = "\x19Ethereum Signed Message:\n32";
  const prefixHex = `0x${Buffer.from(prefix, "utf8").toString("hex")}` as Hex;
  const merged = Uint8Array.from([...hexToBytes(prefixHex), ...hexToBytes(opaque32)]);
  return keccak256(merged);
}

function u64ToSafeNumber(label: string, v: bigint): number {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`invalid_${label}_must_be_safe_non_negative_integer`);
  return n;
}

function buildEvmSerializableTx(payload: Record<string, unknown>): TransactionSerializable {
  const chainIdBig = coerceBig(payload.chainId, "chainId");
  const nonceBig = coerceBig(payload.nonce, "nonce");
  const chainId = u64ToSafeNumber("chainId", chainIdBig);
  const nonce = u64ToSafeNumber("nonce", nonceBig);
  const value = coerceOptionalBig(payload.value, "value") ?? 0n;
  const toMaybe = payload.to ? getAddress(String(payload.to) as Address) : undefined;
  const data =
    typeof payload.data === "string" && payload.data.startsWith("0x") ? (payload.data as Hex) : ("0x" as Hex);

  const gas = coerceOptionalBig(payload.gas, "gas");
  const gasPrice = coerceOptionalBig(payload.gasPrice, "gasPrice");
  const maxFeePerGas = coerceOptionalBig(payload.maxFeePerGas, "maxFeePerGas");
  const maxPriorityFeePerGas = coerceOptionalBig(payload.maxPriorityFeePerGas, "maxPriorityFeePerGas");

  if (maxFeePerGas !== undefined && maxPriorityFeePerGas !== undefined) {
    const base = {
      type: "eip1559" as const,
      chainId,
      nonce,
      to: toMaybe,
      value,
      data,
      maxFeePerGas,
      maxPriorityFeePerGas,
      ...(gas !== undefined ? { gas } : {}),
      ...(Array.isArray(payload.accessList)
        ? { accessList: payload.accessList as { address: Address; storageKeys: Hex[] }[] }
        : {})
    };
    return base as TransactionSerializable;
  }

  const legacyBase = {
    type: "legacy" as const,
    chainId,
    nonce,
    to: toMaybe,
    value,
    data,
    ...(gas !== undefined ? { gas } : {}),
    ...(gasPrice !== undefined ? { gasPrice } : {})
  };
  return legacyBase as TransactionSerializable;
}

export type SignOutcome = {
  signature: string;
  signingOutput: Record<string, unknown>;
};

export async function performSign(
  method: SigningMethod,
  payload: Record<string, unknown>,
  masterSeed: Uint8Array,
  userId: string
): Promise<SignOutcome> {
  const evmPk = deriveEvmPrivateKey(masterSeed, userId);
  const account = privateKeyToAccount(evmPk);

  if (method === "personal_sign") {
    assertSameEvmFrom(payload, account.address);

    const msgRaw = String(requirePayloadField(payload, "message", "personal_sign_requires_message"));
    const message =
      msgRaw.startsWith("0x") && /^0x(?:[a-fA-F0-9]{2})+$/.test(msgRaw)
        ? ({ raw: msgRaw as Hex } satisfies Parameters<typeof signMessage>[0]["message"])
        : msgRaw;

    const sig = await signMessage({
      privateKey: evmPk,
      message: message as Parameters<typeof signMessage>[0]["message"]
    });

    return {
      signature: sig,
      signingOutput: { scheme: "eip1193/personal_sign", address: account.address }
    };
  }

  if (method === "eth_sign") {
    assertSameEvmFrom(payload, account.address);

    const hashHexRaw = String(requirePayloadField(payload, "hash", "eth_sign_requires_32_byte_opaque_hex")).trim();
    const opaque = hashHexRaw as Hex;
    if (!opaque.startsWith("0x") || opaque.length !== 66) throw new Error("eth_sign_expects_exact_32_byte_opaque_hex");

    const digest = ethSignEthereumMessageDigest(opaque);
    const sig = await account.sign({ hash: digest });

    return {
      signature: sig,
      signingOutput: { scheme: "json_rpc/eth_sign", address: account.address }
    };
  }

  if (method === "eth_signTypedData_v4") {
    assertSameEvmFrom(payload, account.address);

    const typedEnvelope = requirePayloadField<Record<string, unknown>>(payload, "typedData", "typed_data_required");

    const sig = await signTypedData({
      privateKey: evmPk,
      domain: (typedEnvelope.domain ?? {}) as TypedDataDefinition["domain"],
      types: (typedEnvelope.types ?? {}) as TypedDataDefinition["types"],
      primaryType: String(typedEnvelope.primaryType ?? "") as TypedDataDefinition["primaryType"],
      message: (typedEnvelope.message ?? {}) as TypedDataDefinition["message"]
    });

    return {
      signature: sig,
      signingOutput: { scheme: "eip712/eth_signTypedData_v4", address: account.address }
    };
  }

  if (method === "eth_signTransaction" || method === "eth_sendTransaction") {
    assertSameEvmFrom(payload, account.address);

    const builtTx = buildEvmSerializableTx(payload);

    const signedRaw = await signTransaction({ privateKey: evmPk, transaction: builtTx });
    const blobHash = keccak256(signedRaw as Hex);

    return {
      signature: blobHash,
      signingOutput: {
        scheme: method,
        signedRawTransaction: signedRaw,
        fingerprintKeccakSignedBlob: blobHash,
        address: account.address,
        broadcastNote:
          method === "eth_sendTransaction"
            ? "Submit signedRawTransaction JSON-RPC eth_sendRawTransaction yourself to obtain mined tx_hash"
            : null
      }
    };
  }

  const solSeed = deriveSolanaSeed(masterSeed, userId);
  const kp = Keypair.fromSeed(solSeed);

  if (method === "solana_signMessage") {
    assertSameSolPubkey(payload, kp.publicKey.toBase58());

    const rawMsg = String(requirePayloadField(payload, "message", "solana_sign_requires_message_utf8"));
    const msgBytes = Uint8Array.from(Buffer.from(rawMsg, "utf8"));
    const detached = nacl.sign.detached(msgBytes, kp.secretKey);

    const sigB64 = Buffer.from(detached).toString("base64");

    return {
      signature: sigB64,
      signingOutput: { scheme: "solana/signMessage_ed25519_detached_base64", address: kp.publicKey.toBase58() }
    };
  }

  if (method === "solana_signTransaction") {
    assertSameSolPubkey(payload, kp.publicKey.toBase58());

    const b64Wire = String(requirePayloadField(payload, "serializedTransactionBase64", "sol_tx_requires_wire_base64"));
    const raw = Uint8Array.from(Buffer.from(b64Wire, "base64"));
    const vtx = VersionedTransaction.deserialize(raw);
    vtx.sign([kp]);
    const signedB64 = Buffer.from(vtx.serialize()).toString("base64");

    return {
      signature: signedB64,
      signingOutput: { scheme: "solana/versioned_tx_signed_base64", address: kp.publicKey.toBase58() }
    };
  }

  throw new Error(`unsupported_method:${method}`);
}
