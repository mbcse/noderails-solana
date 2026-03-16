import type { BalanceItem, TransactionSummaryItem, TxItem } from '../goldrush/types.js';

export type RiskTier = 'low' | 'medium' | 'high';

export interface RiskFinding {
  code: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  metric?: number | string;
}

export interface RiskAssessmentInput {
  walletAddress: string;
  chainName: string;
  balances: BalanceItem[];
  recentTransactions: TxItem[];
  summary: TransactionSummaryItem | undefined;
  dataFetchedAt?: string;
}

export interface RiskAssessment {
  walletAddress: string;
  chainName: string;
  score: number;
  tier: RiskTier;
  findings: RiskFinding[];
  metrics: Record<string, number | string | null>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Rule-based risk scoring from GoldRush balances + tx summary + recent txs.
 * Scores are heuristic (not legal/financial advice); tune weights for your deployment.
 */
export function assessWalletRisk(input: RiskAssessmentInput): RiskAssessment {
  const findings: RiskFinding[] = [];
  let score = 0;

  const items = input.balances ?? [];
  const denom = Math.max(1, items.length);
  const spamCount = items.filter((i) => i.is_spam === true).length;
  const spamRatio = spamCount / denom;
  const spamPoints = spamRatio * 35;
  score += spamPoints;
  if (spamRatio > 0.4) {
    findings.push({
      code: 'SPAM_TOKEN_LOAD',
      severity: spamRatio > 0.65 ? 'critical' : 'warn',
      message: 'Large share of token positions flagged as suspected spam by GoldRush.',
      metric: Math.round(spamRatio * 100),
    });
  }

  const dustCount = items.filter((i) => i.type === 'dust').length;
  const dustRatio = dustCount / denom;
  score += dustRatio * 18;
  if (dustRatio > 0.5) {
    findings.push({
      code: 'DUST_HEAVY',
      severity: 'warn',
      message: 'Portfolio dominated by dust-tier positions (low economic weight).',
      metric: Math.round(dustRatio * 100),
    });
  }

  const summary = input.summary;
  const totalTx = summary?.total_count ?? null;
  if (totalTx !== null && totalTx < 8) {
    score += 12;
    findings.push({
      code: 'LOW_TX_COUNT',
      severity: 'info',
      message: 'Few lifetime transactions, limited behavioral history for scoring.',
      metric: totalTx,
    });
  }

  const earliestStr = summary?.earliest_transaction?.block_signed_at;
  if (earliestStr) {
    const earliest = new Date(earliestStr);
    if (!Number.isNaN(earliest.getTime())) {
      const ageDays = daysBetween(new Date(), earliest);
      if (ageDays < 14) {
        score += 18;
        findings.push({
          code: 'RECENT_ORIGIN',
          severity: 'warn',
          message: 'Wallet first activity within approximately the last 14 days.',
          metric: Math.round(ageDays),
        });
      }
    }
  }

  const txs = input.recentTransactions ?? [];
  const sample = txs.length;
  if (sample > 0) {
    const failed = txs.filter((t) => t.successful === false).length;
    const failRatio = failed / sample;
    score += failRatio * 28;
    if (failRatio > 0.35) {
      findings.push({
        code: 'HIGH_FAILED_TX_RATIO',
        severity: failRatio > 0.55 ? 'critical' : 'warn',
        message: 'Elevated ratio of failed transactions in recent activity sample.',
        metric: Math.round(failRatio * 100),
      });
    }
  }

  score = clamp(Math.round(score), 0, 100);

  let tier: RiskTier = 'low';
  if (score >= 65) tier = 'high';
  else if (score >= 38) tier = 'medium';

  const metrics: Record<string, number | string | null> = {
    spam_ratio_pct: Math.round(spamRatio * 1000) / 10,
    dust_ratio_pct: Math.round(dustRatio * 1000) / 10,
    balance_positions: items.length,
    recent_tx_sample_size: sample,
    lifetime_tx_count: totalTx,
    data_fetched_at: input.dataFetchedAt ?? null,
  };

  return {
    walletAddress: input.walletAddress,
    chainName: input.chainName,
    score,
    tier,
    findings,
    metrics,
  };
}
