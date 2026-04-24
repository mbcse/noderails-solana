'use client';

import { useMemo } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from 'connectkit';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getSolanaPublicRpcUrl, NODE_RAILS_SOLANA_CHAIN_IDS } from '@noderails/common';
import { buildWagmiConfig, type WagmiChainInput } from '@/lib/wagmi';

import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient();

function defaultSolanaRpcForChains(chains: WagmiChainInput[]): string {
  const sol =
    chains.find((c) => c.chainType === 'SOLANA') ??
    chains.find((c) => NODE_RAILS_SOLANA_CHAIN_IDS.has(c.chainId));
  return (
    sol?.rpcUrl?.trim() ||
    (sol?.chainId != null ? getSolanaPublicRpcUrl(sol.chainId) : undefined) ||
    'https://api.devnet.solana.com'
  );
}

export function CheckoutWeb3Provider({
  chains,
  children,
}: {
  chains: WagmiChainInput[];
  children: React.ReactNode;
}) {
  const wagmiConfig = useMemo(() => buildWagmiConfig(chains), [chains]);

  const solanaEndpoint = useMemo(() => defaultSolanaRpcForChains(chains), [chains]);

  const solanaWallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  // Solana adapters wrap EVM so the wallet modal portals above ConnectKit and
  // Phantom/Solflare detection is not affected by wagmi's injected connector.
  return (
    <ConnectionProvider endpoint={solanaEndpoint} key={solanaEndpoint}>
      <WalletProvider wallets={solanaWallets} autoConnect={false}>
        <WalletModalProvider>
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <ConnectKitProvider
                theme="auto"
                mode="light"
                options={{
                  embedGoogleFonts: true,
                  enforceSupportedChains: false,
                }}
              >
                {children}
              </ConnectKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
