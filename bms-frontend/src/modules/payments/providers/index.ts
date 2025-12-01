import type { PaymentProvider } from './base';
import { MockPaymentProvider } from './mock';
import { TelebirrProvider } from './telebirr';
import { CbeBirrProvider } from './cbe-birr';
import { ChapaProvider } from './chapa';
import { HelloCashProvider } from './hellocash';
import type { PaymentProvider as ProviderType } from '../payment-intent';

/**
 * Factory function to get a payment provider instance.
 */
export function getPaymentProvider(provider: ProviderType): PaymentProvider {
  switch (provider) {
    case 'telebirr':
      return new TelebirrProvider();
    case 'cbe_birr':
      return new CbeBirrProvider();
    case 'chapa':
      return new ChapaProvider();
    case 'hellocash':
      return new HelloCashProvider();
    case 'bank_transfer':
      // For bank transfer, use mock provider for now
      return new MockPaymentProvider();
    default:
      // Default to mock provider for unknown providers
      return new MockPaymentProvider();
  }
}

/**
 * Get all available payment providers.
 */
export function getAvailableProviders(): ProviderType[] {
  return ['telebirr', 'cbe_birr', 'chapa', 'hellocash', 'bank_transfer'];
}

export { MockPaymentProvider, TelebirrProvider, CbeBirrProvider, ChapaProvider, HelloCashProvider };
export type { PaymentProvider } from './base';
