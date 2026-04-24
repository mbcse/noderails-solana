import { Connection, PublicKey } from "@solana/web3.js";
import { createPublicClient, erc20Abi, formatEther, http, isAddress } from "viem";
import { base, mainnet, polygon } from "viem/chains";

export type ChainAdapter = {
  family: "evm" | "solana";
  broadcast(raw: string): Promise<string>;
};

export const evmClients = {
  ethereum: createPublicClient({ chain: mainnet, transport: http(process.env.EVM_RPC_MAINNET) }),
  base: createPublicClient({ chain: base, transport: http(process.env.EVM_RPC_BASE) }),
  polygon: createPublicClient({ chain: polygon, transport: http(process.env.EVM_RPC_POLYGON) })
};

export const solanaConnection = new Connection(
  process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"
);

export async function fetchEvmNativeBalance(rpcUrl: string, address: string): Promise<string> {
  if (!isAddress(address)) {
    return "0";
  }
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl)
  });
  const wei = await client.getBalance({ address });
  return Number(formatEther(wei)).toFixed(6);
}

export async function fetchSolanaNativeBalance(rpcUrl: string, address: string): Promise<string> {
  const conn = new Connection(rpcUrl);
  const lamports = await conn.getBalance(new PublicKey(address));
  return (lamports / 1_000_000_000).toFixed(6);
}

export async function fetchEvmErc20Balance(
  rpcUrl: string,
  ownerAddress: string,
  tokenAddress: string,
  decimals = 6
): Promise<string> {
  if (!isAddress(ownerAddress) || !isAddress(tokenAddress)) {
    return "0";
  }
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl)
  });
  const raw = (await client.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "balanceOf",
    args: [ownerAddress]
  })) as bigint;
  const divisor = 10 ** decimals;
  return (Number(raw) / divisor).toFixed(6);
}

export async function fetchSolanaSplBalance(
  rpcUrl: string,
  ownerAddress: string,
  mintAddress: string
): Promise<string> {
  const conn = new Connection(rpcUrl);
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(mintAddress);
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner, { mint });
  const sum = tokenAccounts.value.reduce((acc, item) => {
    const ui = item.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
    return acc + ui;
  }, 0);
  return sum.toFixed(6);
}

export async function getEvmChainHealth(rpcUrl: string): Promise<{ ok: boolean; blockNumber?: string; error?: string }> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl)
    });
    const blockNumber = await client.getBlockNumber();
    return { ok: true, blockNumber: String(blockNumber) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "rpc_error" };
  }
}

export async function getSolanaChainHealth(rpcUrl: string): Promise<{ ok: boolean; slot?: number; error?: string }> {
  try {
    const conn = new Connection(rpcUrl);
    const slot = await conn.getSlot();
    return { ok: true, slot };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "rpc_error" };
  }
}
