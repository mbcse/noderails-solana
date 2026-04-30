import { db } from "@noderails-card/database";

/** Default ERC-20 / SPL rows paired with `DEFAULT_CHAINS` keys in chain registry. */
export const DEFAULT_TOKEN_ROWS = [
  {
    chainKey: "ethereum-mainnet",
    symbol: "USDC",
    kind: "erc20" as const,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6
  },
  {
    chainKey: "solana-mainnet",
    symbol: "USDC",
    kind: "spl" as const,
    contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6
  }
];

export async function seedDefaultTokens(): Promise<number> {
  let n = 0;
  for (const t of DEFAULT_TOKEN_ROWS) {
    await db.tokenConfig.upsert({
      where: { chainKey_symbol: { chainKey: t.chainKey, symbol: t.symbol } },
      update: {},
      create: {
        chainKey: t.chainKey,
        symbol: t.symbol,
        kind: t.kind,
        contractAddress: t.contractAddress,
        decimals: t.decimals,
        isEnabled: true
      }
    });
    n += 1;
  }
  return n;
}
