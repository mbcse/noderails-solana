import type { IKeyProvider } from '@noderails-card/crypto';
import { V1KeyProvider } from './v1.provider.js';
import { EnclaveKeyProvider } from './enclave.provider.js';
import { LegacyKeyProvider } from './legacy.provider.js';

export function createKeyProvider(): IKeyProvider {
  const name = (process.env.KEY_PROVIDER ?? '').trim() || 'v1';

  if (name === 'v1') {
    const appId = process.env.KEY_PROVIDER_APP_ID ?? '';
    const apiKey = process.env.KEY_PROVIDER_API_KEY ?? '';
    const baseUrl = process.env.KEY_PROVIDER_BASE_URL ?? 'https://api.privy.io/v1';
    if (!appId || !apiKey) {
      console.error('[signer-host] KEY_PROVIDER_APP_ID and KEY_PROVIDER_API_KEY are required when KEY_PROVIDER=v1');
      process.exit(1);
    }
    return new V1KeyProvider(appId, apiKey, baseUrl);
  }

  if (name === 'enclave') {
    return new EnclaveKeyProvider();
  }

  if (name === 'legacy') {
    return new LegacyKeyProvider();
  }

  console.error(`[signer-host] Unknown KEY_PROVIDER value: "${name}". Valid values: v1, enclave, legacy`);
  process.exit(1);
}

export type { IKeyProvider };
export { V1KeyProvider, EnclaveKeyProvider, LegacyKeyProvider };
