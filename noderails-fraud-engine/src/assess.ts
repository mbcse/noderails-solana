import { loadConfig } from './config.js';
import { GoldRushClient } from './goldrush/client.js';
import { assessWalletRisk } from './engine/risk-engine.js';
import { buildComplianceReport, reportToJson, type ComplianceReport } from './report/build-report.js';

export interface AssessWalletOptions {
  walletAddress: string;
}

/**
 * Full assessment as structured report (use from HTTP API or programmatic integrations).
 */
export async function assessWalletReport(options: AssessWalletOptions): Promise<ComplianceReport> {
  const config = loadConfig();
  const client = new GoldRushClient({
    goldrushApiKey: config.goldrushApiKey,
    quoteCurrency: config.quoteCurrency,
  });

  const address = options.walletAddress.trim();
  if (!address) {
    throw new Error('walletAddress is required');
  }

  const [balances, recentTx, summaryBody] = await Promise.all([
    client.getTokenBalances(config.chainName, address),
    client.getRecentTransactions(config.chainName, address, { noLogs: true }),
    client.getTransactionSummary(config.chainName, address),
  ]);

  const summaryItem = summaryBody.items?.[0];
  const fetchedAt =
    balances.updated_at ?? recentTx.updated_at ?? summaryBody.updated_at ?? new Date().toISOString();

  const assessment = assessWalletRisk({
    walletAddress: address,
    chainName: config.chainName,
    balances: balances.items ?? [],
    recentTransactions: recentTx.items ?? [],
    summary: summaryItem,
    dataFetchedAt: fetchedAt,
  });

  return buildComplianceReport(assessment);
}

/**
 * Same pipeline as assessWalletReport; returns JSON string for CLI and logging.
 */
export async function assessWallet(options: AssessWalletOptions): Promise<string> {
  const report = await assessWalletReport(options);
  return reportToJson(report);
}
