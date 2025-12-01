import {
  createPaymentIntent,
  findPaymentIntentById,
  updatePaymentIntent,
  cancelPaymentIntent,
  type CreatePaymentIntentInput,
  type PaymentIntent,
} from './payment-intent';
import { getPaymentProvider } from './providers';
import type { PaymentInitiationResult } from './payment-intent';

/**
 * Payment Intent Service
 * Handles payment intent creation and provider interaction.
 */
export class PaymentIntentService {
  /**
   * Creates a payment intent and initiates payment with the provider.
   */
  static async createAndInitiatePayment(input: CreatePaymentIntentInput): Promise<{
    intent: PaymentIntent;
    result: PaymentInitiationResult;
  }> {
    // Create payment intent record
    const intent = await createPaymentIntent(input);

    // Get payment provider
    const provider = getPaymentProvider(input.provider);

    if (!provider.isEnabled()) {
      throw new Error(`Payment provider ${input.provider} is not enabled`);
    }

    // Initiate payment with provider
    const result = await provider.initiatePayment(intent);

    // Update intent with provider response
    await updatePaymentIntent(intent._id, {
      status: result.redirectUrl ? 'processing' : 'pending',
      redirectUrl: result.redirectUrl ?? null,
      paymentInstructions: result.paymentInstructions ?? null,
      referenceNumber: result.referenceNumber ?? null,
      providerMetadata: result.metadata ?? null,
    });

    // Get updated intent
    const updatedIntent = await findPaymentIntentById(intent._id, input.organizationId);
    if (!updatedIntent) {
      throw new Error('Failed to retrieve created payment intent');
    }

    return {
      intent: updatedIntent,
      result,
    };
  }

  /**
   * Gets payment intent status.
   */
  static async getPaymentIntentStatus(
    intentId: string,
    organizationId: string,
  ): Promise<PaymentIntent | null> {
    return findPaymentIntentById(intentId, organizationId);
  }

  /**
   * Cancels a payment intent.
   */
  static async cancelPayment(intentId: string): Promise<PaymentIntent | null> {
    return cancelPaymentIntent(intentId);
  }
}
