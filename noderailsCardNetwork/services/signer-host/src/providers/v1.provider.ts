import type { IKeyProvider, WalletResult, SignRequest, SignResult } from '@noderails-card/crypto';

/**
 * Privy REST wallet RPC (OpenAPI `WalletRpcRequestBody`).
 * Docs / schema: https://api.privy.io/v1/openapi.json — use https://api.privy.io/v1 as base URL.
 * Bodies are discriminated by `method`; many variants forbid extra keys (`additionalProperties: false`).
 */
export class V1KeyProvider implements IKeyProvider {
  readonly providerName = 'v1';
  private readonly apiKey: string;
  private readonly appId: string;
  private readonly baseUrl: string;

  constructor(appId: string, apiKey: string, baseUrl: string) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async generateWallet(userId: string): Promise<WalletResult> {
    let evmRes: { id: string; address: string };
    try {
      evmRes = (await this.providerPost('/wallets', {
        chain_type: 'ethereum',
        policy_ids: []
      })) as { id: string; address: string };
    } catch (err) {
      throw err;
    }

    let solRes: { id: string; address: string };
    try {
      solRes = (await this.providerPost('/wallets', {
        chain_type: 'solana',
        policy_ids: []
      })) as { id: string; address: string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      throw new Error(`key_provider_error:solana_wallet_creation_failed:${msg}:orphaned_evm_ref=${evmRes.id}`);
    }

    return {
      evmAddress: evmRes.address,
      solanaAddress: solRes.address,
      evmWalletRef: evmRes.id,
      solanaWalletRef: solRes.id,
      accountAlias: userId
    };
  }

  async sign(walletRef: string, req: SignRequest): Promise<SignResult> {
    const payload = req.payload as Record<string, unknown>;
    const chainId =
      req.chainId ??
      (typeof payload.chainId === 'number' ? payload.chainId : undefined) ??
      (typeof payload.chainId === 'string' && /^\d+$/.test(payload.chainId) ? Number(payload.chainId) : undefined);

    if (req.chain === 'evm' && req.method === 'eth_sendTransaction') {
      if (!chainId || !Number.isInteger(chainId) || chainId <= 0) {
        throw new Error('key_provider_error:eth_sendTransaction_requires_positive_integer_chainId');
      }
    }

    const rpcPayload = this.buildPrivyWalletRpcBody(req, chainId);
    const res = await this.providerPost(`/wallets/${walletRef}/rpc`, rpcPayload);

    const signature = (res as Record<string, unknown>).data
      ? (((res as { data: Record<string, unknown> }).data.signature as string | undefined) ??
          ((res as { data: Record<string, unknown> }).data.signed_transaction as string | undefined))
      : undefined;

    if (!signature) {
      throw new Error('key_provider_error:missing_signature_in_response');
    }

    return {
      signature,
      signingOutput: (res as { data?: Record<string, unknown> }).data ?? {},
      providerTag: 'v1'
    };
  }

  /** Maps WallCard / EIP-1193-shaped payloads into Privy's wallet RPC schema. */
  private buildPrivyWalletRpcBody(req: SignRequest, chainId: number | undefined): Record<string, unknown> {
    const p = req.payload as Record<string, unknown>;

    if (req.chain === 'evm') {
      const caip2 = chainId && chainId > 0 ? (`eip155:${chainId}` as const) : undefined;

      switch (req.method) {
        case 'personal_sign': {
          const msg = String(p.message ?? '');
          const isHexMessage =
            msg.startsWith('0x') &&
            msg.length >= 4 &&
            msg.length % 2 === 0 &&
            /^0x[0-9a-fA-F]+$/.test(msg);
          return {
            method: 'personal_sign',
            chain_type: 'ethereum',
            params: {
              message: msg,
              encoding: isHexMessage ? 'hex' : 'utf-8'
            }
          };
        }
        case 'eth_sign': {
          const hash = String(p.hash ?? '');
          return {
            method: 'secp256k1_sign',
            chain_type: 'ethereum',
            params: { hash }
          };
        }
        case 'eth_signTypedData_v4': {
          const raw = (p.typedData ?? p.typed_data) as Record<string, unknown> | undefined;
          if (!raw || typeof raw !== 'object') {
            throw new Error('key_provider_error:eth_signTypedData_v4_requires_typedData');
          }
          const typed_data = {
            domain: raw.domain ?? {},
            types: raw.types ?? {},
            message: raw.message ?? {},
            primary_type: String(raw.primaryType ?? raw.primary_type ?? '')
          };
          return {
            method: 'eth_signTypedData_v4',
            chain_type: 'ethereum',
            params: { typed_data }
          };
        }
        case 'eth_signTransaction':
          return {
            method: 'eth_signTransaction',
            chain_type: 'ethereum',
            params: {
              transaction: this.mapEvmTxPayloadToPrivy(p)
            }
          };
        case 'eth_sendTransaction': {
          if (!caip2) throw new Error('key_provider_error:eth_sendTransaction_requires_chainId');
          return {
            method: 'eth_sendTransaction',
            chain_type: 'ethereum',
            caip2,
            params: {
              transaction: this.mapEvmTxPayloadToPrivy(p)
            }
          };
        }
        default:
          throw new Error(`key_provider_error:unsupported_evm_method:${req.method}`);
      }
    }

    if (req.chain === 'solana') {
      if (req.method === 'solana_signMessage') {
        const raw = String(p.message ?? '');
        const message = Buffer.from(raw, 'utf8').toString('base64');
        return {
          method: 'signMessage',
          chain_type: 'solana',
          params: {
            message,
            encoding: 'base64'
          }
        };
      }
      if (req.method === 'solana_signTransaction') {
        const transaction = String(p.serializedTransactionBase64 ?? '');
        return {
          method: 'signTransaction',
          chain_type: 'solana',
          params: {
            transaction,
            encoding: 'base64'
          }
        };
      }
      throw new Error(`key_provider_error:unsupported_solana_method:${req.method}`);
    }

    throw new Error('key_provider_error:unsupported_chain');
  }

  /** Converts viem-style / demo camelCase tx fields to Privy `UnsignedStandardEthereumTransaction`. */
  private mapEvmTxPayloadToPrivy(p: Record<string, unknown>): Record<string, unknown> {
    const chainRaw = p.chainId;
    const cid =
      typeof chainRaw === 'number'
        ? chainRaw
        : typeof chainRaw === 'string' && /^\d+$/.test(chainRaw)
          ? Number(chainRaw)
          : undefined;
    if (cid === undefined || !Number.isInteger(cid) || cid <= 0) {
      throw new Error('key_provider_error:transaction_requires_positive_chainId');
    }

    const nonceNum = Number(p.nonce ?? 0);
    const gasLimit = Number(p.gas ?? 21000);
    const maxFee = p.maxFeePerGas;
    const maxPrio = p.maxPriorityFeePerGas;

    const base: Record<string, unknown> = {
      from: String(p.from ?? ''),
      chain_id: cid,
      nonce: nonceNum,
      data: typeof p.data === 'string' ? p.data : '0x',
      value: this.quantityFromUnknown(p.value ?? '0')
    };

    if (p.to !== undefined && p.to !== null && String(p.to).length > 0) {
      base.to = String(p.to);
    }

    if (maxFee !== undefined && maxPrio !== undefined) {
      base.type = 2;
      base.max_fee_per_gas = Number(maxFee);
      base.max_priority_fee_per_gas = Number(maxPrio);
      base.gas_limit = gasLimit;
      return base;
    }

    base.type = 0;
    base.gas_limit = gasLimit;
    base.gas_price = Number(p.gasPrice ?? 1_000_000_000);
    return base;
  }

  private quantityFromUnknown(v: unknown): number | string {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'bigint') return Number(v);
    const s = String(v);
    if (s.startsWith('0x')) return s;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  private async providerPost(path: string, body: unknown): Promise<unknown> {
    const credentials = Buffer.from(`${this.appId}:${this.apiKey}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
          'privy-app-id': this.appId
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`key_provider_error:${res.status}:${errText}`);
      }
      return res.json();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('key_provider_timeout');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
