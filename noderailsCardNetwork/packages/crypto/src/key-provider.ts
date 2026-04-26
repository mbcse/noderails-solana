export interface WalletResult {
  evmAddress: string;
  solanaAddress: string;
  evmWalletRef: string;      // opaque ref — never logged or exposed externally
  solanaWalletRef: string;
  accountAlias: string;
}

export interface SignRequest {
  chain: 'evm' | 'solana';
  method: string;
  payload: Record<string, unknown>;
  chainId?: number;          // required for EVM signing
}

export interface SignResult {
  signature: string;
  signingOutput: Record<string, unknown>;
  providerTag: string;       // "v1" | "enclave-v2" | "legacy-simulate" — never the vendor name
}

export interface IKeyProvider {
  readonly providerName: string;
  generateWallet(userId: string): Promise<WalletResult>;
  sign(walletRef: string, req: SignRequest): Promise<SignResult>;
}
