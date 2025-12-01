import { BasePaymentProvider } from './base';
import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';

/**
 * Chapa payment provider (mock implementation for MVP).
 * In production, this would integrate with Chapa's actual API.
 */
export class ChapaProvider extends BasePaymentProvider {
  getProviderName(): string {
    return 'Chapa';
  }

  isEnabled(): boolean {
    return process.env.CHAPA_ENABLED === 'true' || process.env.NODE_ENV === 'development';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    this.validateIntent(intent);

    console.log(`[Chapa] Initiating payment:`, {
      intentId: intent._id,
      amount: intent.amount,
      tenantId: intent.tenantId,
    });

    const referenceNumber = `CHAPA-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    if (process.env.NODE_ENV === 'development' || !process.env.CHAPA_SECRET_KEY) {
      return {
        paymentInstructions:
          `Chapa Payment Instructions (Mock):\n\n` +
          `Reference: ${referenceNumber}\n` +
          `Amount: ${intent.currency} ${intent.amount.toLocaleString()}\n\n` +
          `In production, you would be redirected to Chapa to complete payment.`,
        referenceNumber,
        metadata: {
          mock: true,
          provider: 'chapa',
          intentId: intent._id,
        },
      };
    }

    throw new Error('Chapa integration not yet implemented');
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult> {
    console.log(`[Chapa] Verifying payment:`, { reference, metadata });

    if (process.env.NODE_ENV === 'development' || !process.env.CHAPA_SECRET_KEY) {
      return {
        success: true,
        referenceNumber: reference,
        metadata: {
          mock: true,
          provider: 'chapa',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    throw new Error('Chapa verification not yet implemented');
  }
}
