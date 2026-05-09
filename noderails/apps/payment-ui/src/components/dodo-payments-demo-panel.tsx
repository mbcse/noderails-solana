'use client';

import { useCallback, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { createDodoCardCheckoutSession, isDodoCardCheckoutEnabled } from '@/lib/dodo-card-checkout';

/**
 * Card checkout via **Dodo Payments**: asks NodeRails to create a hosted checkout session, then opens Dodo’s URL.
 * UI gate: `NEXT_PUBLIC_ENABLE_DODO_CARD=true`. Server must enable `DODO_PAYMENTS_*` env vars.
 */
export function DodoPaymentsDemoPanel({ checkoutSessionId }: { checkoutSessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = isDodoCardCheckoutEnabled();
  if (!enabled) return null;

  const openCardCheckout = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { checkoutUrl } = await createDodoCardCheckoutSession(checkoutSessionId);
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start card checkout');
    } finally {
      setLoading(false);
    }
  }, [checkoutSessionId]);

  return (
    <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 mb-1">
        Pay with card
      </p>
      <p className="text-[13px] text-violet-900/85 leading-snug mb-3">
        Dodo Payments · Hosted checkout opens in a new tab (session created by NodeRails API).
      </p>
      {error ? (
        <p className="text-[13px] text-red-700 mb-2" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={loading}
        onClick={() => void openCardCheckout()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Opening checkout…
          </>
        ) : (
          <>
            Continue with card
            <ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}
