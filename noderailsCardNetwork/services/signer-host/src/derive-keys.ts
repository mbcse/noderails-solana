import { hkdfSync } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { privateKeyToAccount } from "viem/accounts";

/**
 * HKDF-derived EVM signing key bound to PIN-protected Shamir recombined seed.
 * Separate counter space from Solana derivation.
 */
const te = new TextEncoder();

export function deriveEvmPrivateKey(masterSeed: Uint8Array, userId: string): `0x${string}` {
  const salt = te.encode(`${userId}:evm`);
  for (let counter = 0; counter < 256; counter++) {
    const info = te.encode(`WallCard/v1/sk/${counter}`);
    const raw = hkdfSync("sha512", Uint8Array.from(masterSeed), salt, info, 32);
    const hex = (`0x${Buffer.from(new Uint8Array(raw)).toString("hex")}`) as `0x${string}`;
    try {
      privateKeyToAccount(hex);
      return hex;
    } catch {
      continue;
    }
  }
  throw new Error("evm_key_derive_failed");
}

export function deriveSolanaSeed(masterSeed: Uint8Array, userId: string): Uint8Array {
  const salt = te.encode(`${userId}:solana`);
  const info = te.encode("WallCard/v1/sk/0");
  const raw = hkdfSync("sha512", Uint8Array.from(masterSeed), salt, info, 32);
  return new Uint8Array(raw);
}

export function solanaAddressFromSeed(seed32: Uint8Array): string {
  return Keypair.fromSeed(seed32).publicKey.toBase58();
}

export function evmAddressAlias16(checksumAddress: `0x${string}`): string {
  const compact = checksumAddress.slice(2).toLowerCase();
  return compact.slice(-16);
}
