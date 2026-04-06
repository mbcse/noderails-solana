'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { type ReactNode, useState, useEffect, useMemo } from 'react';

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  // Lazily import wagmiConfig only on the client to avoid MetaMask SDK
  // accessing indexedDB during SSR.
  const wagmiConfig = useMemo(() => {
    if (typeof window === 'undefined') return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/lib/wagmi').wagmiConfig;
  }, []);

  useEffect(() => setMounted(true), []);

  if (!wagmiConfig) return null;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#635bff',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {mounted ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
