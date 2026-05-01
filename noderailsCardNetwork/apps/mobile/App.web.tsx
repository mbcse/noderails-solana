/** Built by `pnpm --filter @noderails-card/mobile build:tailwind-web` (runs in `build:ci` before export). */
import './src/web/mobile-tailwind.bundle.css';
import './src/web/wallet-embed.css';
import React from 'react';
import AppMain from './AppMain';
import WalletAuthWeb from './src/web/WalletAuthWeb';
import { WalletEmbedChrome } from './src/web/WalletEmbedChrome';
import { WalletSignWeb } from './src/web/WalletSignWeb';

function walletEmbedRoute(): 'auth' | 'sign' | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/auth') return 'auth';
  if (path.startsWith('/sign')) return 'sign';
  return null;
}

export default function App() {
  const embed = walletEmbedRoute();
  if (embed === 'auth') {
    return (
      <WalletEmbedChrome>
        <WalletAuthWeb />
      </WalletEmbedChrome>
    );
  }
  if (embed === 'sign') {
    return (
      <WalletEmbedChrome>
        <WalletSignWeb />
      </WalletEmbedChrome>
    );
  }
  return <AppMain />;
}
