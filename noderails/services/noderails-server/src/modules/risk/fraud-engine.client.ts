/**
 * HTTP client for `noderails-fraud-engine` (Solana wallet assessment).
 */
import type { Logger } from '@noderails/service-base';

export interface FraudAssessmentSnapshot {
  fraudTier: string;
  fraudScore: number;
  fraudFetchedAt: string;
  fraudFindingCount: number;
}

export async function fetchSolanaWalletFraudSnapshot(opts: {
  baseUrl: string;
  bearerToken?: string;
  walletAddress: string;
  logger: Logger;
  timeoutMs?: number;
}): Promise<FraudAssessmentSnapshot | null> {
  const { baseUrl, bearerToken, walletAddress, logger, timeoutMs = 12_000 } = opts;
  const trimmedBase = baseUrl.trim();
  if (!trimmedBase) return null;

  const url = `${trimmedBase}/v1/solana/wallets/${encodeURIComponent(walletAddress.trim())}/assessment`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (bearerToken?.trim()) {
      headers.Authorization = `Bearer ${bearerToken.trim()}`;
    }

    const res = await fetch(url, { signal: controller.signal, headers });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      logger.warn('Fraud engine returned non-JSON', { status: res.status });
      return null;
    }

    if (!res.ok) {
      logger.warn('Fraud engine HTTP error', { status: res.status, snippet: text.slice(0, 200) });
      return null;
    }

    const data =
      typeof json === 'object' &&
      json &&
      'data' in json &&
      typeof (json as { data?: unknown }).data === 'object'
        ? (json as { data: Record<string, unknown> }).data
        : null;

    const assessment =
      data &&
      typeof data === 'object' &&
      'assessment' in data &&
      typeof (data as { assessment?: unknown }).assessment === 'object'
        ? (data as { assessment: Record<string, unknown> }).assessment
        : null;

    if (!assessment) {
      logger.warn('Fraud engine payload missing assessment');
      return null;
    }

    const tier = assessment.tier;
    const score = assessment.score;
    const findings = assessment.findings;

    const fraudTier = typeof tier === 'string' ? tier : 'unknown';
    const fraudScore = typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : -1;
    const fraudFindingCount = Array.isArray(findings) ? findings.length : 0;

    return {
      fraudTier,
      fraudScore,
      fraudFetchedAt: new Date().toISOString(),
      fraudFindingCount,
    };
  } catch (err) {
    logger.warn('Fraud engine request failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
