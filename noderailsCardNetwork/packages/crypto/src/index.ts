export type { WalletResult, SignRequest, SignResult, IKeyProvider } from "./key-provider.js";

import { DecryptCommand, EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { argon2id } from "@noble/hashes/argon2";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { combine, split } from "shamirs-secret-sharing-ts";

const kms = new KMSClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export type WrappedShare = {
  kmsKeyId: string;
  blob: Uint8Array;
  index: "A" | "B";
  pinProtected: boolean;
};

export function splitSecret2of2(secret: Uint8Array): [Uint8Array, Uint8Array] {
  const [a, b] = split(Buffer.from(secret), { shares: 2, threshold: 2 }) as Buffer[];
  return [Uint8Array.from(a), Uint8Array.from(b)];
}

export function combineSecret2of2(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = combine([Buffer.from(a), Buffer.from(b)]) as Buffer;
  return Uint8Array.from(out);
}

export function derivePinKey(pin: string, salt: Uint8Array): Uint8Array {
  return argon2id(pin, salt, {
    t: 3,
    m: 1 << 18,
    p: 1,
    dkLen: 32
  });
}

export async function kmsEncrypt(kmsKeyId: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const out = await kms.send(new EncryptCommand({ KeyId: kmsKeyId, Plaintext: plaintext }));
  return out.CiphertextBlob ?? new Uint8Array();
}

export async function kmsDecrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
  const out = await kms.send(new DecryptCommand({ CiphertextBlob: ciphertext }));
  return out.Plaintext ?? new Uint8Array();
}

export function randomSalt(): Uint8Array {
  return Uint8Array.from(randomBytes(16));
}

export type PinEncryptedShareBlob = {
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

export function encryptShareWithPin(share: Uint8Array, pin: string, userId: string): PinEncryptedShareBlob {
  const salt = randomSalt();
  const iv = Uint8Array.from(randomBytes(12));
  const key = derivePinKey(pin, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(new TextEncoder().encode(`${userId}|share_b|v1`));
  const chunkA = cipher.update(share);
  const chunkB = cipher.final();
  const ciphertext = Uint8Array.from([...chunkA, ...chunkB]);
  const tag = cipher.getAuthTag();
  return {
    salt: Buffer.from(salt).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptShareWithPin(blob: PinEncryptedShareBlob, pin: string, userId: string): Uint8Array {
  const salt = Uint8Array.from(Buffer.from(blob.salt, "base64"));
  const iv = Uint8Array.from(Buffer.from(blob.iv, "base64"));
  const key = derivePinKey(pin, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(new TextEncoder().encode(`${userId}|share_b|v1`));
  decipher.setAuthTag(Uint8Array.from(Buffer.from(blob.tag, "base64")));
  const partA = decipher.update(Uint8Array.from(Buffer.from(blob.ciphertext, "base64")));
  const partB = decipher.final();
  return Uint8Array.from([...partA, ...partB]);
}
