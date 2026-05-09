export type WalletActivityRow = {
  id: string;
  status: string;
  chainFamily: string;
  method: string;
  createdAt: string;
  requestSource?: string | null;
  requestOrigin?: string | null;
  error?: string | null;
};

/** Maps stored signing method id to friendly labels in activity and settings. */
export function shortMethodLabel(method: string): string {
  const map: Record<string, string> = {
    personal_sign: 'Personal message',
    eth_sign: 'Hash approval',
    eth_signTypedData_v4: 'Structured request',
    eth_signTransaction: 'Approve transaction',
    eth_sendTransaction: 'Send payment',
    solana_signMessage: 'Solana message',
    solana_signTransaction: 'Solana payment'
  };
  return map[method] ?? method.replace(/_/g, ' ');
}

export function activityPrimaryTitle(chainFamily: string, method: string): string {
  const chain = chainFamily === 'solana' ? 'Solana' : 'Ethereum';
  return `${shortMethodLabel(method)} · ${chain}`;
}

export function activitySourceSubtitle(source?: string | null, origin?: string | null): string {
  const src =
    source === 'mobile_app'
      ? 'WallCard app'
      :       source === 'wallet_sdk_iframe'
        ? 'Website connection'
        : source
          ? source.replace(/_/g, ' ')
          : 'Unknown origin';
  if (!origin || origin.length < 4) return src;
  const trimmed = origin.length > 42 ? `${origin.slice(0, 39)}…` : origin;
  return `${src} · ${trimmed}`;
}

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'Signed';
    case 'failed':
      return 'Failed';
    case 'awaiting_pin':
    case 'awaiting_otp':
      return 'Awaiting confirm';
    default:
      return status.replace(/_/g, ' ');
  }
}
