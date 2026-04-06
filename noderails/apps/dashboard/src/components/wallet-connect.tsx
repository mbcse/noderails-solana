'use client';

import { useState } from 'react';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui';
import { Wallet, Check, AlertCircle } from 'lucide-react';

interface WalletConnectProps {
  onWalletVerified: (address: string, signature: string) => void;
  appName: string;
  walletType?: 'receiving' | 'payout';
}

export function WalletConnect({ onWalletVerified, appName, walletType = 'receiving' }: WalletConnectProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [signing, setSigning] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!address) return;
    setSigning(true);
    setError('');
    try {
      const walletLabel = walletType === 'payout' ? 'payout wallet' : 'receiving wallet';
      const message = `I confirm that I own this wallet and authorize it as the ${walletLabel} for "${appName}" on NodeRails.\n\nWallet: ${address}\nTimestamp: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });
      setVerified(true);
      onWalletVerified(address, signature);
    } catch (err: any) {
      setError(err.shortMessage ?? err.message ?? 'Signing failed');
    } finally {
      setSigning(false);
    }
  };

  if (verified && address) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-300 px-4 py-3 flex items-center gap-3">
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-700">Wallet verified</p>
          <p className="text-xs text-emerald-700/70 font-mono truncate">{address}</p>
        </div>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted border border-border px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Connected wallet</p>
            <p className="text-sm font-mono text-foreground truncate">{address}</p>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        </div>
        <Button onClick={handleVerify} disabled={signing} className="w-full" size="sm">
          <Wallet className="h-4 w-4" />
          {signing ? 'Signing...' : 'Sign to verify ownership'}
        </Button>
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
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button onClick={openConnectModal} variant="secondary" className="w-full" size="sm">
            <Wallet className="h-4 w-4" />
            Connect wallet
          </Button>
        )}
      </ConnectButton.Custom>
      <p className="text-xs text-muted-foreground text-center">
        Connect your wallet to verify ownership and set it as the receiving address
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
