import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, base, bsc, avalanche } from 'wagmi/chains';

/**
 * All RPC calls go through LeanRPC — our own multi-chain RPC provider.
 * URL pattern: https://rpc.leanrpc.xyz/rpc?chainId={chainId}&apiKey={key}
 */
const LEANRPC_API_KEY = process.env.NEXT_PUBLIC_LEANRPC_API_KEY ?? '';
const leanRpc = (chainId: number) =>
  http(`https://rpc.leanrpc.xyz/rpc?chainId=${chainId}&apiKey=${LEANRPC_API_KEY}`);

const chains = [mainnet, polygon, arbitrum, optimism, base, bsc, avalanche] as const;

export const wagmiConfig = getDefaultConfig({
  appName: 'NodeRails Dashboard',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'noderails-dev',
  chains,
  transports: Object.fromEntries(chains.map((c) => [c.id, leanRpc(c.id)])) as any,
});
