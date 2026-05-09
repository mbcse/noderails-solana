'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Shield,
  ExternalLink,
  XCircle,
  Wallet,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  RefreshCw,
  ChevronDown,
  Package,
  CreditCard,
} from 'lucide-react';
import { ConnectKitButton } from 'connectkit';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount, useBalance, useSendTransaction } from 'wagmi';
import { formatUnits } from 'viem';
import {
  useTokenBalance,
  useTokenAllowance,
  useTokenApproval,
  usePermitSign,
  usePriceConversion,
  useChainSwitch,
  useIntentStatusPolling,
} from '../lib/checkout-hooks';
import type { AuthorizePaymentInput } from '../lib/api';
import { authorizePayment, reportNativeCapture } from '../lib/api';
import { getSolanaPublicRpcUrl, isNativeToken, shortenAddress, blockExplorerTxUrl } from '@noderails/common';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  createApproveInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { SearchableSelect } from './searchable-select';
import { DodoPaymentsDemoPanel } from './dodo-payments-demo-panel';
import { track } from '../lib/analytics';

/** Wallet pre-instruction budget for capture txs; Solana max per tx is 1.4M CUs. */
const SOLANA_NATIVE_CAPTURE_CU_LIMIT = 1_400_000;

// ── Iframe parent-frame messaging ──
// When the hosted checkout is embedded as an iframe (e.g. by the
// pretix-noderails plugin), the merchant integration listens for these
// events to react instantly without waiting for a server-side poll.
function notifyParentFrame(
  type: 'noderails:checkout-complete' | 'noderails:checkout-failed' | 'noderails:checkout-cancelled',
  data: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  try {
    window.parent.postMessage({ type, ...data }, '*');
  } catch {
    // Embedding origin disallowed message — silent no-op.
  }
}

// ── Types ──

interface ChainInfo {
  chainId: number;
  chainType?: 'EVM' | 'SOLANA';
  name: string;
  displayName: string;
  nativeCurrencySymbol: string;
  iconUrl: string | null;
  isTestnet: boolean;
  escrowAddress?: string;
  rpcUrl?: string | null;
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  tokenKey: string;
  contractAddress: string;
  chainId: number;
  iconUrl: string | null;
  isStablecoin: boolean;
  supportsPermit?: boolean;
  permitVersion?: string | null;
}

interface PaymentLinkData {
  id: string;
  checkoutSessionId: string;
  name: string;
  description?: string | null;
  slug: string;
  amount?: number | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  taxDescription?: string | null;
  currency: string;
  isActive: boolean;
  successUrl?: string | null;
  cancelUrl?: string | null;
  collectCustomerInfo?: boolean;
  requireBillingDetails?: boolean;
  app?: { name: string; environment?: string } | null;
  acceptedChains?: ChainInfo[];
  acceptedTokens?: TokenInfo[];
  productPlan?: {
    name: string;
    description?: string | null;
    imageUrl?: string | null;
  } | null;
  productPlanPrice?: {
    id: string;
    amount: number;
    currency: string;
    billingInterval?: string | null;
    billingIntervalCount?: number | null;
    nickname?: string | null;
  } | null;
  items?: {
    description: string;
    amount: number;
    currency: string;
    quantity: number;
  }[];
}

// ── Checkout Steps ──

type CheckoutStep = 'select' | 'customer-info' | 'review' | 'approve' | 'processing' | 'success' | 'error';

function ceilToSixDecimals(rawAmount: bigint, tokenDecimals: number): bigint {
  if (tokenDecimals <= 6) return rawAmount;
  const scale = 10n ** BigInt(tokenDecimals - 6);
  return ((rawAmount + scale - 1n) / scale) * scale;
}

/** Matches on-chain `escrow_auth` PDA from `noderails_escrow` — used as SPL delegate. */
function escrowAuthorityPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('escrow_auth', 'utf8')], programId);
  return pda;
}

function normalizeSolanaMintString(contractAddress: string): string {
  const s = contractAddress.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) {
    return s.slice(2).trim();
  }
  return s;
}

async function resolveSplMintTokenProgram(conn: Connection, mint: PublicKey): Promise<PublicKey | null> {
  const info = await conn.getAccountInfo(mint, 'confirmed');
  if (!info) {
    return null;
  }
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID;
  }
  if (info.owner.equals(TOKEN_PROGRAM_ID)) {
    return TOKEN_PROGRAM_ID;
  }
  return null;
}

function payerAssociatedTokenAddress(mint: PublicKey, owner: PublicKey, tokenProgramId: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);
}

/** SPL balance at the owner's ATA (0n if no token account). `null` if mint/RPC is unusable. */
async function fetchSplPayerTokenRawBalance(
  conn: Connection,
  mintAddressStr: string,
  ownerBase58: string,
): Promise<bigint | null> {
  try {
    const mint = new PublicKey(normalizeSolanaMintString(mintAddressStr));
    const owner = new PublicKey(ownerBase58);
    const tokenProgramId = await resolveSplMintTokenProgram(conn, mint);
    if (!tokenProgramId) {
      return null;
    }
    const ata = payerAssociatedTokenAddress(mint, owner, tokenProgramId);
    try {
      const acc = await getAccount(conn, ata, 'confirmed', tokenProgramId);
      return acc.amount;
    } catch (e: unknown) {
      if (e instanceof TokenAccountNotFoundError) {
        return 0n;
      }
      throw e;
    }
  } catch {
    return null;
  }
}

// ── Main Component ──

export function PaymentLinkCheckout({ link }: { link: PaymentLinkData }) {
  const { isConnected, address } = useAccount();
  const { publicKey: solanaWalletPk, disconnect: disconnectSolana } = useWallet();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const solanaPublicKey = solanaWalletPk?.toBase58() ?? null;
  const [pendingCaptureTx, setPendingCaptureTx] = useState<{
    hash: string;
    chainType: 'EVM' | 'SOLANA';
    chainId: number;
  } | null>(null);
  const [step, setStep] = useState<CheckoutStep>('select');
  const [intentId, setIntentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingCountry, setBillingCountry] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');

  useEffect(() => {
    track('checkout_viewed', {
      payment_link_id: link.id,
      checkout_session_id: link.checkoutSessionId,
      is_subscription: Boolean(link.productPlanPrice?.billingInterval),
    });
  }, [link.id, link.checkoutSessionId, link.productPlanPrice?.billingInterval]);

  useEffect(() => {
    track('checkout_step_changed', {
      step,
      payment_link_id: link.id,
    });
  }, [step, link.id]);

  const merchantName = link.app?.name ?? 'Merchant';
  const numericAmount = link.amount != null ? Number(link.amount) : null;
  const hasFixedAmount = numericAmount != null && numericAmount > 0;
  const linkedPrice = link.productPlanPrice ?? null;
  const chains = link.acceptedChains ?? [];
  const tokens = link.acceptedTokens ?? [];
  const isTestnet = link.app?.environment === 'TEST' || chains.some((c) => c.isTestnet);

  // Selected chain (needed before token list filtering)
  const selectedChain = chains.find((c) => c.chainId === selectedChainId);

  // Tokens filtered for the selected chain
  const tokensForChain = selectedChainId
    ? tokens.filter((t) => t.chainId === selectedChainId)
    : tokens;

  const selectedToken = tokens.find((t) => t.tokenKey === selectedTokenKey);

  useEffect(() => {
    if (selectedChain && selectedChain.chainType !== 'SOLANA') {
      disconnectSolana();
    }
  }, [selectedChain, disconnectSolana]);

  const walletOkForReview =
    selectedChain?.chainType === 'SOLANA' ? Boolean(solanaPublicKey) : isConnected;
  const canProceedToReview = walletOkForReview && selectedChain && selectedToken && hasFixedAmount;
  const requireBilling = link.requireBillingDetails === true;
  // Always go to customer-info after select (email always required)
  const nextAfterSelect = 'customer-info';

  // ── Inactive link ──

  if (!link.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-gray-900">Link Inactive</p>
          <p className="mt-2 text-sm text-gray-500">
            This payment link is no longer active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* ═══════════ LEFT PANEL — Order summary (dark slate) ═══════════ */}
      <div className="checkout-panel-left hidden md:flex md:w-[45%] lg:w-[44%] flex-col p-10 lg:p-14">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full relative z-10">
          {/* Merchant */}
          <div className="mb-12">
            <p className="text-sm font-medium text-slate-400 tracking-wide uppercase">{merchantName}</p>
          </div>

          {/* Product name + price hero */}
          <div className="space-y-8">
            <div>
              <p className="text-sm text-slate-400 font-medium mb-2">
                {linkedPrice?.billingInterval ? 'Subscribe to' : 'Pay for'}
              </p>
              <h1 className="text-[28px] font-bold text-white leading-snug">{link.name}</h1>
              {link.description && (
                <p className="mt-3 text-[15px] text-slate-400 leading-relaxed">{link.description}</p>
              )}
            </div>

            {/* Big price */}
            {hasFixedAmount && (
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-white tabular-nums tracking-tight">
                  ${numericAmount!.toFixed(2)}
                </span>
                <span className="text-lg text-slate-500 font-medium ml-1">{link.currency}</span>
                {linkedPrice?.billingInterval && (
                  <span className="text-lg text-slate-500 font-medium">
                    /{linkedPrice.billingInterval.toLowerCase()}
                  </span>
                )}
              </div>
            )}

            {/* Subscription plan details */}
            {link.productPlan && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  {link.productPlan.imageUrl ? (
                    <img src={link.productPlan.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
                      <Package className="h-5 w-5 text-indigo-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{link.productPlan.name}</p>
                    {link.productPlan.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{link.productPlan.description}</p>
                    )}
                  </div>
                </div>
                {/* Plan price inside the card */}
                {linkedPrice && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {linkedPrice.billingInterval
                        ? `Billed every ${linkedPrice.billingIntervalCount && linkedPrice.billingIntervalCount > 1 ? `${linkedPrice.billingIntervalCount} ` : ''}${linkedPrice.billingInterval.toLowerCase()}${linkedPrice.billingIntervalCount && linkedPrice.billingIntervalCount > 1 ? 's' : ''}`
                        : 'One-time payment'}
                    </span>
                    <span className="text-sm font-bold text-white tabular-nums">
                      ${Number(linkedPrice.amount).toFixed(2)}
                      {linkedPrice.billingInterval && (
                        <span className="text-xs text-indigo-400 font-medium ml-0.5">/{linkedPrice.billingInterval.toLowerCase()}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Line items — only show if there's no subscription plan (avoids duplication) */}
            {!link.productPlan && link.items && link.items.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] divide-y divide-white/[0.06]">
                {link.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-300">{item.description}</p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-white tabular-nums ml-4">
                      ${(item.amount * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Price breakdown */}
            {hasFixedAmount && link.taxAmount != null && link.taxAmount > 0 && link.subtotal != null && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{linkedPrice?.billingInterval ? 'Plan price' : 'Subtotal'}</span>
                  <span className="text-slate-300 tabular-nums">${Number(link.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{link.taxDescription ?? 'Tax'}</span>
                  <span className="text-slate-300 tabular-nums">${Number(link.taxAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/[0.08]">
                  <span className="text-sm font-medium text-slate-400">
                    {linkedPrice?.billingInterval ? 'Due today' : 'Total'}
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">${numericAmount!.toFixed(2)} {link.currency}</span>
                </div>
              </div>
            )}

            {!hasFixedAmount && !linkedPrice && (
              <p className="text-sm text-slate-500">Open amount: pay what you choose</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-slate-300">
          <Shield className="h-3 w-3" />
          <span>Powered by <span className="font-semibold text-white/80">NodeRails</span></span>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL — Payment flow ═══════════ */}
      <div className="checkout-right-bg flex-1 flex flex-col items-center justify-center px-5 py-8 md:px-10 lg:px-16">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only header */}
          <div className="md:hidden mb-8">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-1">{merchantName}</p>
            <h1 className="text-xl font-bold text-foreground">{link.name}</h1>
            {hasFixedAmount && (
              <p className="text-3xl font-extrabold text-foreground tabular-nums mt-2">
                ${numericAmount!.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{link.currency}</span>
              </p>
            )}
            {link.productPlan && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>{link.productPlan.name}</span>
                {linkedPrice?.billingInterval && (
                  <span className="text-primary font-medium">/{linkedPrice.billingInterval.toLowerCase()}</span>
                )}
              </div>
            )}
          </div>

          {/* Testnet Banner */}
          {isTestnet && (
            <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 font-medium">Test Mode: No real funds will be transferred.</p>
            </div>
          )}

          <DodoPaymentsDemoPanel checkoutSessionId={link.checkoutSessionId} />

          {/* Step Progress */}
          {step !== 'select' && step !== 'customer-info' && (
            <div className="mb-6">
              <StepIndicator currentStep={step} />
            </div>
          )}

          {/* ── Main content card ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)]">
            {step === 'select' && (
              <SelectStep
                chains={chains}
                tokensForChain={tokensForChain}
                selectedChainId={selectedChainId}
                selectedTokenKey={selectedTokenKey}
                tokenEmptyHint={
                  selectedChain?.chainType === 'SOLANA' &&
                  selectedChainId != null &&
                  tokensForChain.length === 0
                    ? 'No tokens are configured for Solana on this link. Ask the merchant to add accepted tokens.'
                    : undefined
                }
                onSelectChain={(chainId) => {
                  setSelectedChainId(chainId);
                  setSelectedTokenKey(null);
                  track('checkout_chain_selected', { chain_id: chainId, payment_link_id: link.id });
                }}
                onSelectToken={(tokenKey) => {
                  setSelectedTokenKey(tokenKey);
                  track('checkout_token_selected', { token_key: tokenKey, payment_link_id: link.id });
                }}
              />
            )}

            {step === 'customer-info' && (
              <CustomerInfoStep
                email={customerEmail}
                name={customerName}
                billingAddress={billingAddress}
                billingCity={billingCity}
                billingState={billingState}
                billingCountry={billingCountry}
                billingPostalCode={billingPostalCode}
                requireBillingDetails={requireBilling}
                onEmailChange={setCustomerEmail}
                onNameChange={setCustomerName}
                onBillingAddressChange={setBillingAddress}
                onBillingCityChange={setBillingCity}
                onBillingStateChange={setBillingState}
                onBillingCountryChange={setBillingCountry}
                onBillingPostalCodeChange={setBillingPostalCode}
                onBack={() => setStep('select')}
                onProceed={() => setStep('review')}
              />
            )}

            {step === 'review' && selectedChain && selectedToken && hasFixedAmount && (
              <ReviewStep
                link={link}
                chain={selectedChain}
                token={selectedToken}
                amountUsd={numericAmount!}
                currency={link.currency || 'USD'}
                solanaPublicKey={solanaPublicKey}
                onBack={() => setStep('customer-info')}
                onProceed={() => setStep('approve')}
              />
            )}

            {step === 'approve' && selectedChain && selectedToken && hasFixedAmount && (
              <ApproveStep
                link={link}
                chain={selectedChain}
                token={selectedToken}
                amountUsd={numericAmount!}
                currency={link.currency || 'USD'}
                solanaPublicKey={solanaPublicKey}
                customerEmail={customerEmail}
                customerName={customerName || undefined}
                billingAddress={billingAddress || undefined}
                billingCity={billingCity || undefined}
                billingState={billingState || undefined}
                billingCountry={billingCountry || undefined}
                billingPostalCode={billingPostalCode || undefined}
                onBack={() => setStep('review')}
                onSubmitted={(id, opts) => {
                  setIntentId(id);
                  if (opts?.captureTxHash && opts.chainType && opts.chainId != null) {
                    setPendingCaptureTx({
                      hash: opts.captureTxHash,
                      chainType: opts.chainType,
                      chainId: opts.chainId,
                    });
                  } else {
                    setPendingCaptureTx(null);
                  }
                  setStep('processing');
                  track('checkout_authorization_succeeded', {
                    intent_id: id,
                    payment_link_id: link.id,
                    chain_id: selectedChain?.chainId,
                    token_key: selectedToken?.tokenKey,
                  });
                }}
                onError={(msg) => {
                  setErrorMessage(msg);
                  setStep('error');
                  track('checkout_authorization_failed', {
                    payment_link_id: link.id,
                    chain_id: selectedChain?.chainId,
                    token_key: selectedToken?.tokenKey,
                    error_message: msg,
                  });
                }}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
              />
            )}

            {step === 'processing' && intentId && (
              <ProcessingStep
                intentId={intentId}
                sessionId={link.checkoutSessionId}
                successUrl={link.successUrl}
                pendingTx={pendingCaptureTx}
                onSuccess={() => setStep('success')}
                onError={(msg) => {
                  setErrorMessage(msg);
                  setStep('error');
                }}
              />
            )}

            {step === 'success' && (
              <SuccessStep successUrl={link.successUrl} merchantName={merchantName} />
            )}

            {step === 'error' && (
              <ErrorStep
                message={errorMessage}
                onRetry={() => window.location.reload()}
              />
            )}

            {/* Action Section */}
            <div className="p-6 space-y-3">
              {step === 'select' && selectedChain?.chainType === 'SOLANA' && (
                <>
                  <div className="flex justify-center [&_.wallet-adapter-button-trigger]:w-full [&_.wallet-adapter-button]:w-full [&_.wallet-adapter-button]:min-h-[52px] [&_.wallet-adapter-button]:rounded-xl [&_.wallet-adapter-button]:bg-[#635bff] [&_.wallet-adapter-button]:px-6 [&_.wallet-adapter-button]:py-3.5 [&_.wallet-adapter-button]:text-[15px] [&_.wallet-adapter-button]:font-semibold [&_.wallet-adapter-button]:text-white [&_.wallet-adapter-button]:shadow-[0_1px_2px_rgba(0,0,0,0.05)] [&_.wallet-adapter-button:hover]:!bg-[#5851ea]">
                    <WalletMultiButton />
                  </div>
                  {canProceedToReview && (
                    <button
                      type="button"
                      onClick={() => setStep(nextAfterSelect as CheckoutStep)}
                      className="w-full rounded-xl bg-[#635bff] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#5851ea] active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    >
                      Continue
                      <ArrowRight className="h-[18px] w-[18px]" />
                    </button>
                  )}
                </>
              )}

              {step === 'select' && selectedChain?.chainType !== 'SOLANA' && (
                <>
                  {!isConnected && (
                    <ConnectKitButton.Custom>
                      {({ show }) => (
                        <button
                          type="button"
                          onClick={show}
                          className="w-full rounded-xl bg-[#635bff] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#5851ea] active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        >
                          <Wallet className="h-[18px] w-[18px]" />
                          Connect Wallet
                        </button>
                      )}
                    </ConnectKitButton.Custom>
                  )}

                  {isConnected && (
                    <>
                      <ConnectKitButton.Custom>
                        {({ show, truncatedAddress }) => (
                          <button
                            type="button"
                            onClick={show}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                          >
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            {truncatedAddress}
                          </button>
                        )}
                      </ConnectKitButton.Custom>

                      {canProceedToReview && (
                        <button
                          type="button"
                          onClick={() => setStep(nextAfterSelect as CheckoutStep)}
                          className="w-full rounded-xl bg-[#635bff] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#5851ea] active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        >
                          Continue
                          <ArrowRight className="h-[18px] w-[18px]" />
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Security + cancel */}
          <div className="mt-5 space-y-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600">
              <Shield className="h-3 w-3" />
              <span>Secured by <span className="font-medium text-gray-700">NodeRails</span> smart contracts</span>
            </div>
            {link.cancelUrl && (
              <a
                href={link.cancelUrl}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel and return <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>

          {/* Footer — mobile only */}
          <p className="md:hidden mt-6 text-center text-[11px] text-gray-600">
            Powered by <span className="font-semibold text-gray-800">NodeRails</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step Indicator ──

function StepIndicator({ currentStep }: { currentStep: CheckoutStep }) {
  const steps = [
    { key: 'review', label: 'Review' },
    { key: 'approve', label: 'Authorize' },
    { key: 'processing', label: 'Processing' },
    { key: 'success', label: 'Done' },
  ];
  const stepOrder = ['review', 'approve', 'processing', 'success'];
  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between gap-1">
      {steps.map((s, i) => {
        const isDone = currentIdx > i;
        const isCurrent = currentStep === s.key;
        return (
          <div key={s.key} className="flex items-center gap-1 flex-1">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                isDone
                  ? 'bg-emerald-500 text-white'
                  : isCurrent
                    ? 'bg-[#635bff] text-white'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={`text-[11px] font-medium truncate ${
                isCurrent
                  ? 'text-gray-900'
                  : isDone
                    ? 'text-emerald-600'
                    : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 mx-1 ${
                  isDone ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Select Step (Chain / Token selection) ──

function SelectStep({
  chains,
  tokensForChain,
  selectedChainId,
  selectedTokenKey,
  tokenEmptyHint,
  onSelectChain,
  onSelectToken,
}: {
  chains: ChainInfo[];
  tokensForChain: TokenInfo[];
  selectedChainId: number | null;
  selectedTokenKey: string | null;
  tokenEmptyHint?: string;
  onSelectChain: (chainId: number) => void;
  onSelectToken: (tokenKey: string) => void;
}) {
  const chainOptions = chains.map((chain) => ({
    value: String(chain.chainId),
    label: chain.displayName,
    sublabel: chain.nativeCurrencySymbol,
    icon: <ChainIcon chain={chain} />,
  }));

  const tokenOptions = tokensForChain.map((token) => ({
    value: token.tokenKey,
    label: token.symbol,
    sublabel: token.name,
    badge: token.isStablecoin ? 'Stablecoin' : undefined,
    icon: <TokenIcon token={token} />,
  }));

  return (
    <div className="border-b border-gray-100 p-6 space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-gray-900">Payment method</h3>
        <p className="text-xs text-gray-500 mt-1">Choose your preferred network and token</p>
      </div>
      {/* Chain Selection */}
      {chains.length > 0 && (
        <SearchableSelect
          label="Select Network"
          options={chainOptions}
          value={selectedChainId != null ? String(selectedChainId) : null}
          onChange={(v) => onSelectChain(Number(v))}
          placeholder="Choose a network..."
          searchPlaceholder="Search networks..."
        />
      )}

      {/* Token Selection */}
      {tokensForChain.length > 0 && (
        <SearchableSelect
          label="Select Token"
          options={tokenOptions}
          value={selectedTokenKey}
          onChange={onSelectToken}
          placeholder="Choose a token..."
          searchPlaceholder="Search tokens..."
        />
      )}
      {tokenEmptyHint && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{tokenEmptyHint}</p>
      )}
    </div>
  );
}

// ── Customer Info Step ──

function CustomerInfoStep({
  email,
  name,
  billingAddress,
  billingCity,
  billingState,
  billingCountry,
  billingPostalCode,
  requireBillingDetails,
  onEmailChange,
  onNameChange,
  onBillingAddressChange,
  onBillingCityChange,
  onBillingStateChange,
  onBillingCountryChange,
  onBillingPostalCodeChange,
  onBack,
  onProceed,
}: {
  email: string;
  name: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingPostalCode: string;
  requireBillingDetails: boolean;
  onEmailChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onBillingAddressChange: (v: string) => void;
  onBillingCityChange: (v: string) => void;
  onBillingStateChange: (v: string) => void;
  onBillingCountryChange: (v: string) => void;
  onBillingPostalCodeChange: (v: string) => void;
  onBack: () => void;
  onProceed: () => void;
}) {
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const billingValid = !requireBillingDetails || (
    name.trim().length > 0 &&
    billingAddress.trim().length > 0 &&
    billingCity.trim().length > 0 &&
    billingState.trim().length > 0 &&
    billingCountry.trim().length > 0 &&
    billingPostalCode.trim().length > 0
  );
  const canContinue = isValidEmail && billingValid;

  const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#635bff]/20 focus:border-[#635bff] transition-all";

  return (
    <div className="border-b border-gray-100 p-6 space-y-4">
      <h3 className="text-[15px] font-semibold text-gray-900">Your information</h3>
      <p className="text-xs text-gray-500">
        Required to complete your payment.
      </p>

      <div className="space-y-3">
        {/* Email — always required */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            required
          />
        </div>

        {/* Name — required when billing required, optional otherwise */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Name {requireBillingDetails
              ? <span className="text-red-500">*</span>
              : <span className="text-xs text-gray-400 font-normal">(optional)</span>
            }
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
        </div>

        {/* Billing details section */}
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Billing details
            {!requireBillingDetails && (
              <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
            )}
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Address {requireBillingDetails && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => onBillingAddressChange(e.target.value)}
                placeholder="123 Main St"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">City {requireBillingDetails && <span className="text-red-500">*</span>}</label>
                <input
                  type="text"
                  value={billingCity}
                  onChange={(e) => onBillingCityChange(e.target.value)}
                  placeholder="City"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">State {requireBillingDetails && <span className="text-red-500">*</span>}</label>
                <input
                  type="text"
                  value={billingState}
                  onChange={(e) => onBillingStateChange(e.target.value)}
                  placeholder="State"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Country {requireBillingDetails && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={billingCountry}
                  onChange={(e) => onBillingCountryChange(e.target.value)}
                  placeholder="Country"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Postal Code {requireBillingDetails && <span className="text-red-500">*</span>}</label>
                <input
                  type="text"
                  value={billingPostalCode}
                  onChange={(e) => onBillingPostalCodeChange(e.target.value)}
                  placeholder="ZIP"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onProceed}
          disabled={!canContinue}
          className="flex-1 rounded-lg bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5851ea] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Review Step (price conversion, balance check, chain switch) ──

function ReviewStep({
  link,
  chain,
  token,
  amountUsd,
  currency,
  solanaPublicKey,
  onBack,
  onProceed,
}: {
  link: PaymentLinkData;
  chain: ChainInfo;
  token: TokenInfo;
  amountUsd: number;
  currency: string;
  solanaPublicKey: string | null;
  onBack: () => void;
  onProceed: () => void;
}) {
  const { address } = useAccount();
  const native = isNativeToken(token.contractAddress);
  const isSolana = chain.chainType === 'SOLANA';
  const isSolanaSpl = isSolana && !native;

  // Price conversion: fiat → token amount
  const price = usePriceConversion(token.symbol, amountUsd, token.decimals, currency);

  // Balance checks
  const { balance: erc20Balance, refetch: refetchErc20 } = useTokenBalance(
    !isSolana && !native ? token.contractAddress : undefined,
    chain.chainId,
    token.decimals,
  );
  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address,
    chainId: chain.chainId,
    query: { enabled: !!address && native && !isSolana },
  });

  const [solanaLamports, setSolanaLamports] = useState<number | null>(null);
  const [solanaBalanceLoading, setSolanaBalanceLoading] = useState(false);

  const solanaRpc =
    chain.rpcUrl ?? getSolanaPublicRpcUrl(chain.chainId) ?? 'https://api.devnet.solana.com';

  const [splTokenRawReview, setSplTokenRawReview] = useState<bigint | null>(null);
  const [splBalanceLoadingReview, setSplBalanceLoadingReview] = useState(false);

  const fetchSplBalanceReview = useCallback(async () => {
    if (!isSolanaSpl || !solanaPublicKey) {
      setSplTokenRawReview(null);
      return;
    }
    setSplBalanceLoadingReview(true);
    try {
      const conn = new Connection(solanaRpc, 'confirmed');
      const raw = await fetchSplPayerTokenRawBalance(conn, token.contractAddress, solanaPublicKey);
      setSplTokenRawReview(raw);
    } catch {
      setSplTokenRawReview(null);
    } finally {
      setSplBalanceLoadingReview(false);
    }
  }, [isSolanaSpl, solanaPublicKey, token.contractAddress, solanaRpc]);

  useEffect(() => {
    void fetchSplBalanceReview();
  }, [fetchSplBalanceReview]);

  const refetchSolanaBalance = useCallback(async () => {
    if (!isSolana || !native || !solanaPublicKey) return;
    setSolanaBalanceLoading(true);
    try {
      const { Connection, PublicKey } = await import('@solana/web3.js');
      const conn = new Connection(solanaRpc, 'confirmed');
      const lamports = await conn.getBalance(new PublicKey(solanaPublicKey));
      setSolanaLamports(lamports);
    } finally {
      setSolanaBalanceLoading(false);
    }
  }, [isSolana, native, solanaPublicKey, solanaRpc]);

  useEffect(() => {
    void refetchSolanaBalance();
  }, [refetchSolanaBalance]);

  // Chain switch
  const { needsSwitch, switchToTarget, isPending: isSwitching } = useChainSwitch(
    isSolana ? undefined : chain.chainId,
  );

  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const handleRefreshBalance = useCallback(async () => {
    setIsRefreshingBalance(true);
    try {
      if (isSolanaSpl) {
        await fetchSplBalanceReview();
      } else if (isSolana && native) {
        await refetchSolanaBalance();
      } else if (native) {
        await refetchNative();
      } else {
        await refetchErc20();
      }
    } finally {
      setTimeout(() => setIsRefreshingBalance(false), 500);
    }
  }, [isSolanaSpl, isSolana, native, fetchSplBalanceReview, refetchSolanaBalance, refetchNative, refetchErc20]);

  const balanceLoading = isSolanaSpl
    ? splBalanceLoadingReview
    : isSolana && native
      ? solanaBalanceLoading || (solanaLamports === null && !!solanaPublicKey)
      : native
        ? !nativeBalance && !!address
        : erc20Balance === undefined && !!address;

  const displayBalance =
    isSolanaSpl
      ? splTokenRawReview != null
        ? Number(formatUnits(splTokenRawReview, token.decimals)).toFixed(6)
        : undefined
      : isSolana && native
        ? solanaLamports != null
          ? Number(formatUnits(BigInt(solanaLamports), token.decimals)).toFixed(6)
          : undefined
        : native
          ? nativeBalance
            ? Number(formatUnits(nativeBalance.value, nativeBalance.decimals)).toFixed(6)
            : undefined
          : erc20Balance !== undefined
            ? Number(formatUnits(erc20Balance, token.decimals)).toFixed(6)
            : undefined;

  const rawBalance =
    isSolanaSpl
      ? splTokenRawReview ?? 0n
      : isSolana && native
        ? solanaLamports != null
          ? BigInt(solanaLamports)
          : 0n
        : native
          ? (nativeBalance?.value ?? 0n)
          : (erc20Balance ?? 0n);

  const hasSufficientBalance = price.data ? rawBalance >= price.data.rawAmount : false;

  return (
    <div className="border-b border-gray-100 p-6 space-y-4">
      <h3 className="text-[15px] font-semibold text-gray-900">Review payment</h3>

      {/* Payment method summary */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <ChainIcon chain={chain} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{chain.displayName}</p>
          <p className="text-xs text-gray-500">{token.symbol} &middot; {token.name}</p>
        </div>
        <p className="text-sm font-bold text-gray-900 tabular-nums">{amountUsd.toFixed(2)} {currency}</p>
      </div>

      {/* Crypto Conversion */}
      <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">You pay</span>
          {price.isLoading ? (
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Fetching rate...
            </span>
          ) : price.data ? (
            <span className="text-xl font-bold text-gray-900 tabular-nums">
              {Number(price.data.tokenAmount).toFixed(6)} <span className="text-sm font-semibold text-gray-500">{token.symbol}</span>
            </span>
          ) : (
            <span className="text-sm text-red-500">Failed to fetch price</span>
          )}
        </div>

        {price.data && (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Exchange rate</span>
            <span className="tabular-nums">1 {token.symbol} = {price.data.priceUsd.toFixed(2)} {currency}</span>
          </div>
        )}
      </div>

      {/* Wallet Balance */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet balance</span>
          <div className="flex items-center gap-1.5">
            {balanceLoading ? (
              <span className="flex items-center gap-1.5 text-sm text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </span>
            ) : displayBalance != null ? (
              <span
                className={`text-sm font-semibold tabular-nums ${
                  hasSufficientBalance
                    ? 'text-emerald-600'
                    : price.data
                      ? 'text-red-500'
                      : 'text-gray-900'
                }`}
              >
                {displayBalance} {token.symbol}
              </span>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            )}
            <button
              onClick={handleRefreshBalance}
              disabled={isRefreshingBalance}
              className="p-1 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              title="Refresh balance"
            >
              <RefreshCw className={`h-3 w-3 text-gray-400 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {hasSufficientBalance && price.data && (
          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Sufficient balance
          </p>
        )}
      </div>

      {/* Insufficient balance warning */}
      {price.data && !hasSufficientBalance && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-600">Insufficient balance</p>
            <p className="text-xs text-red-500 mt-0.5">
              You need {Number(price.data.tokenAmount).toFixed(6)} {token.symbol} but only have {displayBalance ?? '0'} {token.symbol}.
            </p>
          </div>
        </div>
      )}

      {/* Chain switch needed */}
      {needsSwitch && (
        <button
          onClick={switchToTarget}
          disabled={isSwitching}
          className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-gray-700 flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
        >
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowLeftRight className="h-4 w-4" />
          )}
          Switch to {chain.displayName}
        </button>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onProceed}
          disabled={!hasSufficientBalance || needsSwitch || !price.data}
          className="flex-1 rounded-lg bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5851ea] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Authorize Payment
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Approve Step (permit sign or ERC20 approve, then submit) ──

function ApproveStep({
  link,
  chain,
  token,
  amountUsd,
  currency,
  solanaPublicKey,
  customerEmail,
  customerName,
  billingAddress,
  billingCity,
  billingState,
  billingCountry,
  billingPostalCode,
  onBack,
  onSubmitted,
  onError,
  isSubmitting,
  setIsSubmitting,
}: {
  link: PaymentLinkData;
  chain: ChainInfo;
  token: TokenInfo;
  amountUsd: number;
  currency: string;
  solanaPublicKey: string | null;
  customerEmail: string;
  customerName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  billingPostalCode?: string;
  onBack: () => void;
  onSubmitted: (
    intentId: string,
    opts?: { captureTxHash?: string; chainType?: 'EVM' | 'SOLANA'; chainId?: number },
  ) => void;
  onError: (msg: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}) {
  const { address } = useAccount();
  const { sendTransaction: solanaSendTransaction } = useWallet();
  const isSolana = chain.chainType === 'SOLANA';
  const native = isNativeToken(token.contractAddress);
  const escrowAddress = chain.escrowAddress;
  const supportsPermit = token.supportsPermit && !native && !isSolana;

  // Subscription detection: if there's a billingInterval, this is a recurring charge.
  // For subscriptions, we cap the approval at 1 year's worth of charges so the
  // escrow can pull funds for future billing cycles without re-approval.
  const isSubscription = !!link.productPlanPrice?.billingInterval;
  const isSolanaSpl = isSolana && !native;

  // Price conversion for the raw amount
  const price = usePriceConversion(token.symbol, amountUsd, token.decimals, currency);

  // Compute the approval/permit requested amount as a 6-decimal rounded-up value
  // while keeping the actual payment authorization amount exact.
  const authRequestAmount = useMemo(() => {
    if (!price.data?.rawAmount) return undefined;

    const roundedUpSixDecimals = ceilToSixDecimals(price.data.rawAmount, token.decimals);
    if (!isSubscription) return roundedUpSixDecimals;

    const interval = link.productPlanPrice!.billingInterval!;
    const intervalCount = link.productPlanPrice!.billingIntervalCount ?? 1;
    let cyclesPerYear: number;
    switch (interval.toUpperCase()) {
      case 'MINUTE': cyclesPerYear = Math.ceil(525_960 / intervalCount); break;   // ~365.25 days × 24 × 60
      case 'DAY':    cyclesPerYear = Math.ceil(365 / intervalCount); break;
      case 'WEEK':   cyclesPerYear = Math.ceil(52 / intervalCount); break;
      case 'MONTH':  cyclesPerYear = Math.ceil(12 / intervalCount); break;
      case 'YEAR':   cyclesPerYear = Math.ceil(1 / intervalCount); break;
      default:       cyclesPerYear = 12;
    }
    return roundedUpSixDecimals * BigInt(cyclesPerYear);
  }, [price.data?.rawAmount, token.decimals, isSubscription, link.productPlanPrice]);

  const splDelegationAmount = useMemo(() => {
    if (!isSolanaSpl || !price.data) return undefined;
    return isSubscription ? authRequestAmount ?? price.data.rawAmount : price.data.rawAmount;
  }, [isSolanaSpl, price.data, isSubscription, authRequestAmount]);

  // Native token: wagmi sendTransaction for user to send ETH to escrow
  const { sendTransactionAsync } = useSendTransaction();

  // State for native tx flow
  const [nativeTxStep, setNativeTxStep] = useState<'idle' | 'sending' | 'confirming' | 'reporting'>('idle');

  const [splAccountInfo, setSplAccountInfo] = useState<{
    delegated: bigint;
    balance: bigint;
    delegateOk: boolean;
  } | null>(null);
  const [splRefreshing, setSplRefreshing] = useState(false);
  const [splDelegateSending, setSplDelegateSending] = useState(false);

  const refreshSplDelegation = useCallback(async () => {
    if (!isSolanaSpl || !solanaPublicKey || !escrowAddress || splDelegationAmount == null) {
      setSplAccountInfo(null);
      return;
    }
    setSplRefreshing(true);
    try {
      const mint = new PublicKey(normalizeSolanaMintString(token.contractAddress));
      const owner = new PublicKey(solanaPublicKey);
      const programId = new PublicKey(escrowAddress);
      const rpc = chain.rpcUrl ?? getSolanaPublicRpcUrl(chain.chainId) ?? 'https://api.devnet.solana.com';
      const conn = new Connection(rpc, 'confirmed');
      const tokenProgramId = await resolveSplMintTokenProgram(conn, mint);
      if (!tokenProgramId) {
        setSplAccountInfo(null);
        return;
      }
      const ata = payerAssociatedTokenAddress(mint, owner, tokenProgramId);
      try {
        const acc = await getAccount(conn, ata, 'confirmed', tokenProgramId);
        const wantDel = escrowAuthorityPda(programId);
        const delegateOk = acc.delegate != null && acc.delegate.equals(wantDel);
        setSplAccountInfo({ delegated: acc.delegatedAmount, balance: acc.amount, delegateOk });
      } catch (e: unknown) {
        if (e instanceof TokenAccountNotFoundError) {
          setSplAccountInfo({ delegated: 0n, balance: 0n, delegateOk: false });
        } else {
          throw e;
        }
      }
    } catch {
      setSplAccountInfo(null);
    } finally {
      setSplRefreshing(false);
    }
  }, [
    isSolanaSpl,
    solanaPublicKey,
    escrowAddress,
    splDelegationAmount,
    token.contractAddress,
    chain.rpcUrl,
    chain.chainId,
  ]);

  useEffect(() => {
    void refreshSplDelegation();
  }, [refreshSplDelegation]);

  // Balance check — re-verify before submitting capture to avoid wasting gas
  const { balance: erc20Balance } = useTokenBalance(
    !isSolana && !native ? token.contractAddress : undefined,
    chain.chainId,
    token.decimals,
  );
  const { data: nativeBalance } = useBalance({
    address,
    chainId: chain.chainId,
    query: { enabled: !!address && native && !isSolana },
  });
  const rawBalance =
    isSolanaSpl
      ? splAccountInfo?.balance ?? 0n
      : isSolana && native
        ? solanaPublicKey && price.data
          ? price.data.rawAmount
          : 0n
        : native
          ? (nativeBalance?.value ?? 0n)
          : (erc20Balance ?? 0n);

  // Pinned amount: once a permit is signed or approval submitted, we lock
  // the rawAmount so the backend receives the exact amount the user approved.
  // This prevents a price refresh between signing and submission from causing
  // a mismatch (permit signed for amount X, but submit sends amount Y).
  const [pinnedAmount, setPinnedAmount] = useState<{
    rawAmount: bigint;
    priceUsd: number;
  } | null>(null);

  const erc20TokenAddr = !isSolana && !native ? token.contractAddress : undefined;

  // ERC20 Allowance (for non-native, non-permit tokens)
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(erc20TokenAddr, escrowAddress, chain.chainId);

  // ERC20 Approve — for subscriptions, approve a 1-year cap so the escrow can
  // pull funds for all future billing cycles without re-approval.
  const approval = useTokenApproval(erc20TokenAddr, escrowAddress, authRequestAmount, chain.chainId);

  // Permit signing — for subscriptions, sign the 1-year capped amount so the
  // permit sets an allowance covering all charges within a year.
  const permit = usePermitSign(
    supportsPermit ? erc20TokenAddr : undefined,
    supportsPermit ? token.name : undefined,
    escrowAddress,
    authRequestAmount,
    chain.chainId,
    token.permitVersion ?? undefined,
  );

  // Pin the amount when permit is signed successfully
  useEffect(() => {
    if (permit.isReady && price.data && !pinnedAmount) {
      setPinnedAmount({
        rawAmount: price.data.rawAmount,
        priceUsd: price.data.priceUsd,
      });
    }
  }, [permit.isReady, price.data, pinnedAmount]);

  // Check if allowance is already sufficient
  const hasAllowance =
    native || (allowance !== undefined && price.data && allowance >= price.data.rawAmount);

  // Determine authorization method
  const authMethod: 'NATIVE' | 'PERMIT' = native
    ? 'NATIVE'
    : supportsPermit
      ? 'PERMIT'
      : 'NATIVE';

  // Is approved (allowance, permit, native wallet connect, or SPL delegate)
  const isApprovedOrSigned =
    (isSolana && native && !!solanaPublicKey) ||
    (isSolanaSpl &&
      !!solanaPublicKey &&
      !!splAccountInfo &&
      splAccountInfo.delegateOk &&
      splDelegationAmount != null &&
      splAccountInfo.delegated >= splDelegationAmount &&
      !!price.data &&
      splAccountInfo.balance >= price.data.rawAmount) ||
    (!isSolana && (native || (authMethod === 'PERMIT' ? permit.isReady : hasAllowance)));

  const handleSplDelegate = useCallback(async () => {
    if (!isSolanaSpl || !solanaPublicKey || !escrowAddress || splDelegationAmount == null || !price.data) {
      return;
    }
    setSplDelegateSending(true);
    try {
      const mint = new PublicKey(normalizeSolanaMintString(token.contractAddress));
      const owner = new PublicKey(solanaPublicKey);
      const programId = new PublicKey(escrowAddress);
      const rpc = chain.rpcUrl ?? getSolanaPublicRpcUrl(chain.chainId) ?? 'https://api.devnet.solana.com';
      const conn = new Connection(rpc, 'confirmed');
      const tokenProgramId = await resolveSplMintTokenProgram(conn, mint);
      if (!tokenProgramId) {
        throw new Error('Unsupported or unknown SPL mint');
      }
      const ata = payerAssociatedTokenAddress(mint, owner, tokenProgramId);
      const delegate = escrowAuthorityPda(programId);
      const ix = createApproveInstruction(ata, delegate, owner, splDelegationAmount, [], tokenProgramId);
      const tx = new Transaction().add(ix);
      const { blockhash } = await conn.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = owner;
      if (!solanaSendTransaction) {
        throw new Error('Connect a Solana wallet that can sign transactions');
      }
      await solanaSendTransaction(tx, conn, { skipPreflight: false });
      await refreshSplDelegation();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Delegation failed');
    } finally {
      setSplDelegateSending(false);
    }
  }, [
    isSolanaSpl,
    solanaPublicKey,
    escrowAddress,
    splDelegationAmount,
    token.contractAddress,
    chain.rpcUrl,
    chain.chainId,
    price.data,
    refreshSplDelegation,
    onError,
    solanaSendTransaction,
  ]);

  // Handler: submit authorization to server
  const handleSubmit = useCallback(async () => {
    const wallet = isSolana ? solanaPublicKey : address;
    if (!wallet || !price.data || isSubmitting) return;

    // Use pinned amount for permit flow (matches the signed permit value),
    // or fall back to latest price for approval/native flows.
    const submitRawAmount = (authMethod === 'PERMIT' && pinnedAmount)
      ? pinnedAmount.rawAmount
      : price.data.rawAmount;

    // Re-check balance before submitting to avoid wasted gas on a revert
    if (isSolanaSpl && (!splAccountInfo || splAccountInfo.balance < submitRawAmount)) {
      onError(`Insufficient ${token.symbol} balance`);
      return;
    }
    if (
      isSolanaSpl &&
      (!splAccountInfo ||
        !splAccountInfo.delegateOk ||
        splDelegationAmount == null ||
        splAccountInfo.delegated < splDelegationAmount)
    ) {
      onError('Token delegation to NodeRails is incomplete. Approve delegation first.');
      return;
    }

    if (!isSolana && rawBalance < submitRawAmount) {
      onError(`Insufficient ${token.symbol} balance`);
      return;
    }

    const submitPriceUsd = (authMethod === 'PERMIT' && pinnedAmount)
      ? pinnedAmount.priceUsd
      : price.data.priceUsd;

    setIsSubmitting(true);
    track('checkout_authorization_submitted', {
      checkout_session_id: link.checkoutSessionId,
      chain_id: chain.chainId,
      token_key: token.tokenKey,
      auth_method: authMethod,
      is_subscription: isSubscription,
    });
    try {
      const input: AuthorizePaymentInput = {
        checkoutSessionId: link.checkoutSessionId,
        walletAddress: wallet,
        chainId: chain.chainId,
        tokenKey: token.tokenKey,
        authorizationMethod: authMethod,
        cryptoAmount: submitRawAmount.toString(),
        exchangeRate: submitPriceUsd.toString(),
        customerEmail,
      };

      if (customerName) input.customerName = customerName;
      if (billingAddress) input.billingAddress = billingAddress;
      if (billingCity) input.billingCity = billingCity;
      if (billingState) input.billingState = billingState;
      if (billingCountry) input.billingCountry = billingCountry;
      if (billingPostalCode) input.billingPostalCode = billingPostalCode;

      if (authMethod === 'PERMIT' && permit.signature) {
        input.permitSignature = {
          ...permit.signature,
          // The amount the user signed in the permit (1-year cap for subs, exact for one-time)
          amount: (authRequestAmount ?? submitRawAmount).toString(),
        };
      }

      if (!native && authMethod === 'NATIVE' && approval.txHash) {
        input.approvalTxHash = approval.txHash;
      }

      const result = await authorizePayment(input);

      if (
        result.captureData &&
        'instruction' in result.captureData &&
        result.captureData.chainType === 'SOLANA'
      ) {
        setNativeTxStep('sending');
        const { Connection, Transaction, TransactionInstruction, PublicKey } = await import(
          '@solana/web3.js'
        );
        const ins = result.captureData.instruction;
        const pre = result.captureData.preInstructions ?? [];
        const wireIxs = [...pre, ins];
        const ixs = wireIxs.map(
          (w) =>
            new TransactionInstruction({
              programId: new PublicKey(w.programId),
              keys: w.keys.map((k) => ({
                pubkey: new PublicKey(k.pubkey),
                isSigner: k.isSigner,
                isWritable: k.isWritable,
              })),
              data: Buffer.from(w.data, 'base64'),
            }),
        );
        const rpc = chain.rpcUrl ?? getSolanaPublicRpcUrl(chain.chainId) ?? 'https://api.devnet.solana.com';
        const conn = new Connection(rpc, 'confirmed');
        const tx = new Transaction().add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_NATIVE_CAPTURE_CU_LIMIT }),
          ...ixs,
        );
        const { blockhash } = await conn.getLatestBlockhash('finalized');
        tx.recentBlockhash = blockhash;
        tx.feePayer = new PublicKey(wallet);
        if (!solanaSendTransaction) {
          throw new Error('Connect a Solana wallet that can sign transactions');
        }
        const signature = await solanaSendTransaction(tx, conn, { skipPreflight: false });
        if (!signature) {
          throw new Error('Wallet did not return a transaction signature');
        }
        setNativeTxStep('reporting');
        await reportNativeCapture(result.intentId, signature);
        setNativeTxStep('idle');
        onSubmitted(result.intentId, {
          captureTxHash: signature,
          chainType: 'SOLANA',
          chainId: chain.chainId,
        });
        return;
      }

      if (result.captureData && 'to' in result.captureData) {
        // Step 1: Ask user to sign and send the transaction (EVM)
        setNativeTxStep('sending');
        track('checkout_native_capture_prompted', {
          chain_id: chain.chainId,
          token_key: token.tokenKey,
        });
        const txHash = await sendTransactionAsync({
          to: result.captureData.to as `0x${string}`,
          data: result.captureData.data as `0x${string}`,
          value: BigInt(result.captureData.value),
          chainId: result.captureData.chainId,
        });

        // Step 2: Report the tx hash to the server
        setNativeTxStep('reporting');
        await reportNativeCapture(result.intentId, txHash);
        track('checkout_native_capture_reported', {
          intent_id: result.intentId,
          chain_id: chain.chainId,
          token_key: token.tokenKey,
        });

        // Step 3: Done — start polling
        setNativeTxStep('idle');
        onSubmitted(result.intentId, {
          captureTxHash: txHash,
          chainType: 'EVM',
          chainId: result.captureData.chainId,
        });
        return;
      }

      if (result.captureData) {
        throw new Error('Unsupported capture payload');
      }

      // ERC20: server already submitted the tx via MTXM
      onSubmitted(result.intentId);
    } catch (err) {
      setNativeTxStep('idle');
      track('checkout_authorization_failed', {
        checkout_session_id: link.checkoutSessionId,
        chain_id: chain.chainId,
        token_key: token.tokenKey,
        auth_method: authMethod,
        error_message: err instanceof Error ? err.message : 'Authorization failed',
      });
      onError(err instanceof Error ? err.message : 'Authorization failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    solanaPublicKey,
    isSolana,
    isSolanaSpl,
    splAccountInfo,
    splDelegationAmount,
    price.data,
    isSubmitting,
    link.checkoutSessionId,
    chain.chainId,
    chain.rpcUrl,
    token.tokenKey,
    token.symbol,
    authMethod,
    pinnedAmount,
    rawBalance,
    permit.signature,
    native,
    approval.txHash,
    authRequestAmount,
    sendTransactionAsync,
    onSubmitted,
    onError,
    setIsSubmitting,
    customerEmail,
    customerName,
    billingAddress,
    billingCity,
    billingState,
    billingCountry,
    billingPostalCode,
    isSubscription,
    solanaSendTransaction,
  ]);

  // Auto-submit when native token (no approval needed)
  // For ERC20: auto-submit once approved or permit signed
  const shouldAutoSubmit = isApprovedOrSigned && price.data && !isSubmitting;

  return (
    <div className="border-b border-gray-100 p-6 space-y-4">
      <h3 className="text-[15px] font-semibold text-gray-900">Authorize payment</h3>

      {/* Price Info */}
      {price.data && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Amount</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">
              {Number(price.data.tokenAmount).toFixed(6)} {token.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Step 1: Approve / Permit (for ERC20 only) */}
      {!native && !isSolana && (
        <div className="space-y-3">
          {supportsPermit ? (
            // Permit flow
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    permit.isReady
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#635bff] text-white'
                  }`}
                >
                  {permit.isReady ? <Check className="h-3 w-3" /> : '1'}
                </div>
                <span className="text-xs font-medium text-gray-900">Authorize token</span>
              </div>

              {!permit.isReady && (
                <button
                  onClick={permit.signPermit}
                  disabled={permit.isPending || !price.data}
                  className="w-full rounded-lg border border-[#635bff]/20 bg-[#635bff]/5 px-4 py-2.5 text-sm font-medium text-[#635bff] flex items-center justify-center gap-2 hover:bg-[#635bff]/10 transition-colors disabled:opacity-50"
                >
                  {permit.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for signature...
                    </>
                  ) : (
                    <>
                      Authorize in wallet
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}

              {permit.isReady && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Authorization confirmed
                </div>
              )}

              {permit.error && (
                <p className="text-xs text-red-500">{permit.error.message}</p>
              )}
            </div>
          ) : (
            // Approve flow
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    hasAllowance
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#635bff] text-white'
                  }`}
                >
                  {hasAllowance ? <Check className="h-3 w-3" /> : '1'}
                </div>
                <span className="text-xs font-medium text-gray-900">Approve token</span>
              </div>

              {!hasAllowance && (
                <button
                  onClick={() => {
                    approval.approve();
                  }}
                  disabled={approval.isPending || approval.isConfirming || !price.data}
                  className="w-full rounded-lg border border-[#635bff]/20 bg-[#635bff]/5 px-4 py-2.5 text-sm font-medium text-[#635bff] flex items-center justify-center gap-2 hover:bg-[#635bff]/10 transition-colors disabled:opacity-50"
                >
                  {approval.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirm in wallet...
                    </>
                  ) : approval.isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming on-chain...
                    </>
                  ) : (
                    <>
                      Approve {token.symbol}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}

              {hasAllowance && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Token approved
                </div>
              )}

              {approval.isConfirmed && !hasAllowance && (
                <button
                  onClick={() => refetchAllowance()}
                  className="flex items-center gap-1 text-xs text-[#635bff] hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh allowance
                </button>
              )}

              {approval.error && (
                <p className="text-xs text-red-500">{approval.error.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {isSolanaSpl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                splAccountInfo &&
                splDelegationAmount != null &&
                splAccountInfo.delegateOk &&
                splAccountInfo.delegated >= splDelegationAmount
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#635bff] text-white'
              }`}
            >
              {splAccountInfo &&
              splDelegationAmount != null &&
              splAccountInfo.delegateOk &&
              splAccountInfo.delegated >= splDelegationAmount ? (
                <Check className="h-3 w-3" />
              ) : (
                '1'
              )}
            </div>
            <span className="text-xs font-medium text-gray-900">Delegate {token.symbol}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Approve the NodeRails escrow delegate on your associated token account so our infrastructure can move
            the quoted amount after you pay. Subscriptions delegate a one-year maximum, same idea as ERC-20 allowance.
          </p>
          {!splAccountInfo && !splRefreshing && (
            <p className="text-xs text-amber-700">
              Could not read your token account. Fund this wallet with {token.symbol} on this network first.
            </p>
          )}
          {splAccountInfo &&
            (splDelegationAmount == null ||
              !splAccountInfo.delegateOk ||
              splAccountInfo.delegated < splDelegationAmount) && (
              <button
                type="button"
                onClick={() => void handleSplDelegate()}
                disabled={splDelegateSending || splDelegationAmount == null || !price.data || splRefreshing}
                className="w-full rounded-lg border border-[#635bff]/20 bg-[#635bff]/5 px-4 py-2.5 text-sm font-medium text-[#635bff] flex items-center justify-center gap-2 hover:bg-[#635bff]/10 transition-colors disabled:opacity-50"
              >
                {splDelegateSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirm in wallet...
                  </>
                ) : (
                  <>
                    Approve delegation
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          {splAccountInfo &&
            splDelegationAmount != null &&
            splAccountInfo.delegateOk &&
            splAccountInfo.delegated >= splDelegationAmount && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Delegation sufficient
              </div>
            )}
          <button
            type="button"
            onClick={() => void refreshSplDelegation()}
            disabled={splRefreshing}
            className="flex items-center gap-1 text-xs text-[#635bff] hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${splRefreshing ? 'animate-spin' : ''}`} />
            Refresh delegation
          </button>
        </div>
      )}

      {/* Step 2: Submit authorization */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              isSubmitting
                ? 'bg-[#635bff] text-white'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {native && !isSolanaSpl ? '1' : '2'}
          </div>
          <span className="text-xs font-medium text-gray-900">
            {native && !isSolanaSpl ? 'Submit payment' : 'Complete payment'}
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isApprovedOrSigned || isSubmitting || !price.data}
          className="w-full rounded-lg bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5851ea] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {native && nativeTxStep === 'sending'
                ? 'Confirm in wallet...'
                : native && nativeTxStep === 'reporting'
                  ? 'Finalizing...'
                  : 'Submitting...'}
            </>
          ) : (
            <>
              Pay {price.data ? `${Number(price.data.tokenAmount).toFixed(6)} ${token.symbol}` : '...'}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        disabled={isSubmitting}
        className="w-full rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        Back to review
      </button>
    </div>
  );
}

// ── Processing Step (polling intent status) ──

function ProcessingStep({
  intentId,
  sessionId,
  successUrl,
  pendingTx,
  onSuccess,
  onError,
}: {
  intentId: string;
  sessionId: string;
  successUrl?: string | null;
  pendingTx: { hash: string; chainType: 'EVM' | 'SOLANA'; chainId: number } | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const { status } = useIntentStatusPolling(intentId);

  useEffect(() => {
    if (!status) return;
    if (status === 'CAPTURED' || status === 'SETTLED') {
      track('checkout_capture_succeeded', { intent_id: intentId, status });
      notifyParentFrame('noderails:checkout-complete', { sessionId, intentId, status });
      return;
    }

    const failureStatuses = ['FAILED', 'EXPIRED', 'CANCELLED', 'CAPTURE_FAILED', 'PAST_DUE'];
    if (failureStatuses.includes(status)) {
      track('checkout_capture_failed', { intent_id: intentId, status });
      notifyParentFrame('noderails:checkout-failed', { sessionId, intentId, status });
    }
  }, [status, intentId, sessionId]);

  // Detect terminal states
  if (status === 'CAPTURED' || status === 'SETTLED') {
    // Redirect if successUrl is set, otherwise show success
    if (successUrl) {
      window.location.href = successUrl;
    } else {
      // Trigger success step
      setTimeout(onSuccess, 500);
    }
  }

  const failureStatuses = ['FAILED', 'EXPIRED', 'CANCELLED', 'CAPTURE_FAILED', 'PAST_DUE'];
  if (status && failureStatuses.includes(status)) {
    setTimeout(() => onError('Payment error. Please try again later.'), 500);
  }

  const explorerUrl =
    pendingTx?.hash != null && pendingTx.chainId != null
      ? blockExplorerTxUrl(pendingTx.chainId, pendingTx.hash) ?? undefined
      : undefined;

  return (
    <div className="border-b border-gray-100 p-8 text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#635bff]" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">Processing payment</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your payment is being captured on-chain. This may take a moment.
        </p>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#635bff] hover:underline"
          >
            View transaction <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Success Step ──

function SuccessStep({
  successUrl,
  merchantName,
}: {
  successUrl?: string | null;
  merchantName: string;
}) {
  return (
    <div className="border-b border-gray-100 p-8 text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900">Payment successful!</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your payment to {merchantName} has been confirmed.
        </p>
      </div>
      {successUrl && (
        <a
          href={successUrl}
          className="inline-flex items-center gap-2 rounded-lg bg-[#635bff] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5851ea] transition-all"
        >
          Continue <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

// ── Error Step ──

function ErrorStep({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="border-b border-gray-100 p-8 text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <XCircle className="h-10 w-10 text-red-500" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">Payment failed</h3>
        <p className="mt-1 text-sm text-gray-500">
          {message ?? 'An unexpected error occurred.'}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

// ── Sub-components ──

/** Chain icon — renders iconUrl if available, otherwise a colored circle with initials */
function ChainIcon({ chain }: { chain: ChainInfo }) {
  if (chain.iconUrl) {
    return (
      <img
        src={chain.iconUrl}
        alt={chain.displayName}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  const colors = ['#635bff', '#0abf53', '#f2ae00', '#00d4ff', '#db2777', '#ea580c'];
  const colorIndex = chain.chainId % colors.length;

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold"
      style={{ backgroundColor: colors[colorIndex] }}
    >
      {chain.displayName.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Token icon — renders iconUrl if available, otherwise a pill with symbol */
function TokenIcon({ token }: { token: TokenInfo }) {
  if (token.iconUrl) {
    return (
      <img
        src={token.iconUrl}
        alt={token.symbol}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  const colors = ['#635bff', '#0abf53', '#f2ae00', '#00d4ff', '#db2777', '#ea580c'];
  const idx = token.symbol.charCodeAt(0) % colors.length;

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-white text-[10px] font-bold"
      style={{ backgroundColor: colors[idx] }}
    >
      {token.symbol.slice(0, 3)}
    </div>
  );
}
