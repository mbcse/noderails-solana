'use client';

import { useCallback, useMemo, useState } from 'react';
import { clusterApiUrl } from '@solana/web3.js';
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Button } from '@/components/ui';
import { Wallet, Check, AlertCircle } from 'lucide-react';

import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletConnectProps {
  appName: string;
  appEnv: 'TEST' | 'PRODUCTION';
  onVerified: (address: string, signatureBase64: string) => void;
}

function SolanaWalletConnectInner({
  appName,
  onVerified,
}: Pick<SolanaWalletConnectProps, 'appName' | 'onVerified'>) {
  const { publicKey, signMessage, disconnect, connected } = useWallet();
  const [signing, setSigning] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setSigning(true);
    setError('');
    try {
      const message = `I confirm that I own this Solana wallet and authorize it for settlements for "${appName}" on NodeRails.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
      const encoded = new TextEncoder().encode(message);
      const signature = await signMessage(encoded);
      const signatureBase64 = btoa(String.fromCharCode(...signature));
      setVerified(true);
      onVerified(publicKey.toBase58(), signatureBase64);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signing failed';
      setError(msg);
    } finally {
      setSigning(false);
    }
  }, [publicKey, signMessage, appName, onVerified]);

  if (verified && publicKey) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-300 px-4 py-3 flex items-center gap-3">
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-700">Solana wallet verified</p>
          <p className="text-xs text-emerald-700/70 font-mono truncate">{publicKey.toBase58()}</p>
        </div>
      </div>
    );
  }

  if (connected && publicKey) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted border border-border px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Connected Solana wallet</p>
            <p className="text-sm font-mono text-foreground truncate">{publicKey.toBase58()}</p>
          </div>
          <button
            type="button"
            onClick={() => disconnect()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 text-left sm:text-right"
          >
            Disconnect
          </button>
        </div>
        <Button type="button" onClick={handleVerify} disabled={signing || !signMessage} className="w-full" size="sm">
          <Wallet className="h-4 w-4" />
          {signing ? 'Signing...' : 'Sign to verify ownership'}
        </Button>
        {!signMessage && (
          <p className="text-xs text-amber-700">This wallet does not support message signing. Try Phantom or Solflare.</p>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center [&_.wallet-adapter-button-trigger]:w-full [&_button]:w-full">
        <WalletMultiButton />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Choose a Solana wallet, then sign to prove you control the settlement address.
      </p>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Solana connect + sign message, matching the EVM onboarding flow.
 * Uses devnet for TEST apps and mainnet-beta for PRODUCTION.
 */
export function SolanaWalletConnect({ appName, appEnv, onVerified }: SolanaWalletConnectProps) {
  const endpoint = useMemo(
    () => clusterApiUrl(appEnv === 'TEST' ? 'devnet' : 'mainnet-beta'),
    [appEnv],
  );
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <SolanaWalletConnectInner appName={appName} onVerified={onVerified} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
