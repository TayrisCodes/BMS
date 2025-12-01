import { BasePaymentProvider } from './base';
import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';

/**
 * Mock payment provider for development and testing.
 * Simulates payment flow without actual payment processing.
 */
export class MockPaymentProvider extends BasePaymentProvider {
  getProviderName(): string {
    return 'Mock Payment Provider';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    this.validateIntent(intent);

    // Simulate payment initiation
    console.log(`[Mock Payment] Initiating payment:`, {
      intentId: intent._id,
      amount: intent.amount,
      currency: intent.currency,
      tenantId: intent.tenantId,
      invoiceId: intent.invoiceId,
    });

    // Generate mock reference number
    const referenceNumber = `MOCK-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // For mock, return payment instructions instead of redirect URL
    return {
      paymentInstructions:
        `Mock Payment Instructions:\n\n` +
        `Reference: ${referenceNumber}\n` +
        `Amount: ${intent.currency} ${intent.amount.toLocaleString()}\n` +
        `Provider: ${this.getProviderName()}\n\n` +
        `In development mode, this payment will be automatically verified.\n` +
        `In production, you would be redirected to complete the payment.`,
      referenceNumber,
      metadata: {
        mock: true,
        intentId: intent._id,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult> {
    console.log(`[Mock Payment] Verifying payment:`, { reference, metadata });

    // In mock mode, always succeed
    // In production, this would call the provider's verification API
    return {
      success: true,
      referenceNumber: reference,
      amount: typeof metadata?.amount === 'number' ? (metadata.amount as number) : 0,
      metadata: {
        mock: true,
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}
