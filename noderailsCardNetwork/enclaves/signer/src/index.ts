import { randomBytes } from "node:crypto";
import { splitSecret2of2 } from "@noderails-card/crypto";
import { createHash } from "node:crypto";

export async function keygen(): Promise<{ shareA: Uint8Array; shareB: Uint8Array }> {
  const seed = Uint8Array.from(randomBytes(32));
  const [shareA, shareB] = splitSecret2of2(seed);
  return { shareA, shareB };
}

export async function deriveAddresses(seedMaterial: Uint8Array): Promise<{
  evmAddress: string;
  solanaAddress: string;
}> {
  const hex = createHash("sha256").update(seedMaterial).digest("hex");
  return {
    evmAddress: `0x${hex.slice(0, 40)}`,
    solanaAddress: createHash("sha256").update(`sol-${hex}`).digest("hex").slice(0, 44)
  };
}

export async function sign(payload: unknown, secret: Uint8Array): Promise<{ signature: string }> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const input = Uint8Array.from([...secret, ...payloadBytes]);
  const signature = `0x${createHash("sha256")
    .update(input)
    .digest("hex")}`;
  return { signature };
}
