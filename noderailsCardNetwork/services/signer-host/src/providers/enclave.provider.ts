import type { IKeyProvider, WalletResult, SignRequest, SignResult } from '@noderails-card/crypto';

export class EnclaveKeyProvider implements IKeyProvider {
  readonly providerName = 'enclave-v2';

  async generateWallet(_userId: string): Promise<WalletResult> {
    throw new Error('enclave_provider_not_implemented_yet');
  }

  async sign(_walletRef: string, _req: SignRequest): Promise<SignResult> {
    throw new Error('enclave_provider_not_implemented_yet');
  }
}
