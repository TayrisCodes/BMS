import { BasePaymentProvider } from './base';
import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';

/**
 * CBE Birr payment provider (mock implementation for MVP).
 * In production, this would integrate with CBE Birr's actual API.
 */
export class CbeBirrProvider extends BasePaymentProvider {
  getProviderName(): string {
    return 'CBE Birr';
  }

  isEnabled(): boolean {
    return process.env.CBE_BIRR_ENABLED === 'true' || process.env.NODE_ENV === 'development';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    this.validateIntent(intent);

    console.log(`[CBE Birr] Initiating payment:`, {
      intentId: intent._id,
      amount: intent.amount,
      tenantId: intent.tenantId,
    });

    const referenceNumber = `CBE-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    if (process.env.NODE_ENV === 'development' || !process.env.CBE_BIRR_API_KEY) {
      return {
        paymentInstructions:
          `CBE Birr Payment Instructions (Mock):\n\n` +
          `Reference: ${referenceNumber}\n` +
          `Amount: ${intent.currency} ${intent.amount.toLocaleString()}\n\n` +
          `In production, you would be redirected to CBE Birr to complete payment.`,
        referenceNumber,
        metadata: {
          mock: true,
          provider: 'cbe_birr',
          intentId: intent._id,
        },
      };
    }

    throw new Error('CBE Birr integration not yet implemented');
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult> {
    console.log(`[CBE Birr] Verifying payment:`, { reference, metadata });

    if (process.env.NODE_ENV === 'development' || !process.env.CBE_BIRR_API_KEY) {
      return {
        success: true,
        referenceNumber: reference,
        metadata: {
          mock: true,
          provider: 'cbe_birr',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    throw new Error('CBE Birr verification not yet implemented');
  }
}
