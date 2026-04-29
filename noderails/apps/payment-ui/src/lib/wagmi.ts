import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';
import { mainnet, sepolia, polygon, arbitrum, optimism, base } from 'wagmi/chains';
import { defineChain, type Chain } from 'viem';
import { getLeanRpcUrl, NODE_RAILS_SOLANA_CHAIN_IDS } from '@noderails/common';

export interface WagmiChainInput {
  chainId: number;
  name: string;
  displayName?: string;
  nativeCurrencySymbol: string;
  isTestnet: boolean;
  /** Present on API responses when Solana networks are accepted. */
  chainType?: 'EVM' | 'SOLANA';
  rpcUrl?: string | null;
}

function leanRpc(chainId: number) {
  return http(getLeanRpcUrl(chainId));
}

function toWagmiChain(chain: WagmiChainInput) {
  return defineChain({
    id: chain.chainId,
    name: chain.displayName ?? chain.name,
    nativeCurrency: {
      name: chain.nativeCurrencySymbol,
      symbol: chain.nativeCurrencySymbol,
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [getLeanRpcUrl(chain.chainId)] },
      public: { http: [getLeanRpcUrl(chain.chainId)] },
    },
    testnet: chain.isTestnet,
  });
}

function isSolanaChainInput(chain: WagmiChainInput): boolean {
  if (chain.chainType === 'SOLANA') return true;
  return NODE_RAILS_SOLANA_CHAIN_IDS.has(chain.chainId);
}

/** Wagmi only supports EVM; Solana NodeRails chain IDs must never be passed as viem chains. */
function evmChainInputs(chainInputs: WagmiChainInput[]): WagmiChainInput[] {
  return chainInputs.filter((c) => !isSolanaChainInput(c));
}

function buildChains(chainInputs: WagmiChainInput[]) {
  const evmOnly = evmChainInputs(chainInputs);
  return evmOnly.length > 0
    ? evmOnly.map(toWagmiChain)
    : [mainnet, sepolia, polygon, arbitrum, optimism, base];
}

export function buildWagmiConfig(chainInputs: WagmiChainInput[]) {
  const chains = buildChains(chainInputs) as unknown as [Chain, ...Chain[]];

  return createConfig(
    getDefaultConfig({
      chains,
      transports: Object.fromEntries(chains.map((chain) => [chain.id, leanRpc(chain.id)])),
      walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
      appName: 'NodeRails Payment',
      appDescription: 'Secure crypto payment checkout',
      appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    }),
  );
}

export const wagmiConfig = buildWagmiConfig([]);
