import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';

/**
 * Base interface for payment providers.
 * All payment providers must implement this interface.
 */
export interface PaymentProvider {
  /**
   * Initiates a payment with the provider.
   * Returns redirect URL or payment instructions.
   */
  initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult>;

  /**
   * Verifies a payment using the provider's reference number.
   * Used for webhook verification or manual verification.
   */
  verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult>;

  /**
   * Returns the provider's display name.
   */
  getProviderName(): string;

  /**
   * Returns whether this provider is enabled/configured.
   */
  isEnabled(): boolean;
}

/**
 * Base class for payment providers with common functionality.
 */
export abstract class BasePaymentProvider implements PaymentProvider {
  abstract initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult>;
  abstract verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult>;
  abstract getProviderName(): string;

  isEnabled(): boolean {
    // Override in subclasses to check configuration
    return true;
  }

  /**
   * Validates payment intent before processing.
   */
  protected validateIntent(intent: PaymentIntent): void {
    if (intent.status !== 'pending') {
      throw new Error(`Payment intent is not pending (current status: ${intent.status})`);
    }

    if (new Date() >= intent.expiresAt) {
      throw new Error('Payment intent has expired');
    }

    if (intent.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
  }
}
