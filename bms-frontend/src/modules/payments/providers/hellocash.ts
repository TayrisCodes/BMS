import { BasePaymentProvider } from './base';
import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';

/**
 * HelloCash payment provider (mock implementation for MVP).
 * In production, this would integrate with HelloCash's actual API.
 */
export class HelloCashProvider extends BasePaymentProvider {
  getProviderName(): string {
    return 'HelloCash';
  }

  isEnabled(): boolean {
    return process.env.HELLOCASH_ENABLED === 'true' || process.env.NODE_ENV === 'development';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    this.validateIntent(intent);

    console.log(`[HelloCash] Initiating payment:`, {
      intentId: intent._id,
      amount: intent.amount,
      tenantId: intent.tenantId,
    });

    const referenceNumber = `HELLO-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    if (process.env.NODE_ENV === 'development' || !process.env.HELLOCASH_API_KEY) {
      return {
        paymentInstructions:
          `HelloCash Payment Instructions (Mock):\n\n` +
          `Reference: ${referenceNumber}\n` +
          `Amount: ${intent.currency} ${intent.amount.toLocaleString()}\n\n` +
          `In production, you would be redirected to HelloCash to complete payment.`,
        referenceNumber,
        metadata: {
          mock: true,
          provider: 'hellocash',
          intentId: intent._id,
        },
      };
    }

    throw new Error('HelloCash integration not yet implemented');
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult> {
    console.log(`[HelloCash] Verifying payment:`, { reference, metadata });

    if (process.env.NODE_ENV === 'development' || !process.env.HELLOCASH_API_KEY) {
      return {
        success: true,
        referenceNumber: reference,
        metadata: {
          mock: true,
          provider: 'hellocash',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    throw new Error('HelloCash verification not yet implemented');
  }
}
