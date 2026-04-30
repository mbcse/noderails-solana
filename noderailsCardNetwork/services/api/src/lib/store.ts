type OtpRecord = {
  email: string;
  code: string;
  purpose: "login" | "signing";
  expiresAt: number;
};

type SessionRecord = {
  userId: string;
  email: string;
};

type SigningRecord = {
  id: string;
  userId: string;
  chain: "evm" | "solana";
  method: string;
  payload: Record<string, unknown>;
  status: "pending" | "awaiting_pin" | "succeeded" | "failed";
  signature?: string;
};

type WalletState = {
  userId: string;
  accountAlias: string;
  evmAddress: string;
  solanaAddress: string;
  cardMasked: string;
};

export const store = {
  otps: new Map<string, OtpRecord>(),
  sessions: new Map<string, SessionRecord>(),
  signing: new Map<string, SigningRecord>(),
  wallets: new Map<string, WalletState>()
};

export type { SigningRecord, WalletState };
