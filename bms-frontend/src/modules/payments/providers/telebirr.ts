import { BasePaymentProvider } from './base';
import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';

/**
 * Telebirr payment provider (mock implementation for MVP).
 * In production, this would integrate with Telebirr's actual API.
 */
export class TelebirrProvider extends BasePaymentProvider {
  getProviderName(): string {
    return 'Telebirr';
  }

  isEnabled(): boolean {
    // Check if Telebirr is configured (for future: check env vars)
    return process.env.TELEBIRR_ENABLED === 'true' || process.env.NODE_ENV === 'development';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    this.validateIntent(intent);

    console.log(`[Telebirr] Initiating payment:`, {
      intentId: intent._id,
      amount: intent.amount,
      tenantId: intent.tenantId,
    });

    // Mock implementation - in production, this would:
    // 1. Call Telebirr API to create payment request
    // 2. Get redirect URL or payment instructions
    // 3. Return redirect URL for user to complete payment

    const referenceNumber = `TELEBIRR-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    if (process.env.NODE_ENV === 'development' || !process.env.TELEBIRR_API_KEY) {
      // Mock mode
      return {
        paymentInstructions:
          `Telebirr Payment Instructions (Mock):\n\n` +
          `Reference: ${referenceNumber}\n` +
          `Amount: ${intent.currency} ${intent.amount.toLocaleString()}\n\n` +
          `In production, you would be redirected to Telebirr to complete payment.`,
        referenceNumber,
        metadata: {
          mock: true,
          provider: 'telebirr',
          intentId: intent._id,
        },
      };
    }

    // Production implementation would go here
    // const response = await fetch(telebirrApiUrl, { ... });
    // return { redirectUrl: response.redirectUrl, referenceNumber: response.reference };

    throw new Error('Telebirr integration not yet implemented');
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult> {
    console.log(`[Telebirr] Verifying payment:`, { reference, metadata });

    if (process.env.NODE_ENV === 'development' || !process.env.TELEBIRR_API_KEY) {
      // Mock verification - always succeeds in dev
      return {
        success: true,
        referenceNumber: reference,
        metadata: {
          mock: true,
          provider: 'telebirr',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    // Production implementation would call Telebirr verification API
    // const response = await fetch(telebirrVerificationUrl, { ... });
    // return { success: response.success, ... };

    throw new Error('Telebirr verification not yet implemented');
  }
}
