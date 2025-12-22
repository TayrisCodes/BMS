import { BasePaymentProvider } from './base';
import type {
  PaymentIntent,
  PaymentInitiationResult,
  PaymentVerificationResult,
} from '../payment-intent';
import { findTenantById } from '@/lib/tenants/tenants';

/**
 * Chapa payment provider implementation.
 * Integrates with Chapa's payment gateway API.
 * Documentation: https://developer.chapa.co/
 */
export class ChapaProvider extends BasePaymentProvider {
  private secretKey: string | null = null;
  private publicKey: string | null = null;
  private baseUrl: string;
  private isTestMode: boolean;

  constructor() {
    super();
    this.secretKey = process.env.CHAPA_SECRET_KEY || null;
    this.publicKey = process.env.CHAPA_PUBLIC_KEY || null;
    this.baseUrl = process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1';
    this.isTestMode = this.secretKey?.includes('TEST') || process.env.NODE_ENV === 'development';
  }

  getProviderName(): string {
    return 'Chapa';
  }

  isEnabled(): boolean {
    return !!this.secretKey || process.env.NODE_ENV === 'development';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    this.validateIntent(intent);

    console.log(`[Chapa] Initiating payment:`, {
      intentId: intent._id,
      amount: intent.amount,
      tenantId: intent.tenantId,
    });

    // Generate unique transaction reference
    const txRef = `CHAPA-${intent._id}-${Date.now()}`;

    // If no secret key, return mock response
    if (!this.secretKey || this.isTestMode) {
      const mockRedirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tenant/payments/chapa?tx_ref=${txRef}`;
      return {
        redirectUrl: mockRedirectUrl,
        referenceNumber: txRef,
        paymentInstructions: `Chapa Payment (Test Mode):\n\nReference: ${txRef}\nAmount: ${intent.currency} ${intent.amount.toLocaleString()}\n\nIn test mode, payment will be simulated.`,
        metadata: {
          mock: true,
          provider: 'chapa',
          intentId: intent._id,
          txRef,
        },
      };
    }

    try {
      // Get tenant information for payment
      const tenant = await findTenantById(intent.tenantId, intent.organizationId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Prepare Chapa API request
      const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/webhooks/payments/chapa`;
      const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/org/payments/status?tx_ref=${txRef}&intent_id=${intent._id}`;

      const requestBody = {
        amount: intent.amount.toString(),
        currency: intent.currency || 'ETB',
        email: tenant.email || `tenant-${intent.tenantId}@example.com`,
        first_name: tenant.firstName || 'Tenant',
        last_name: tenant.lastName || 'User',
        phone_number: tenant.primaryPhone || undefined,
        tx_ref: txRef,
        callback_url: callbackUrl,
        return_url: returnUrl,
        customization: {
          title: 'BMS Invoice Payment',
          description: `Payment for invoice ${intent.invoiceId || 'N/A'}`,
        },
        meta: {
          intentId: intent._id,
          invoiceId: intent.invoiceId || null,
          tenantId: intent.tenantId,
          organizationId: intent.organizationId,
        },
      };

      // Call Chapa API to initialize transaction
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Chapa API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.status !== 'success' || !data.data?.checkout_url) {
        throw new Error(data.message || 'Failed to initialize Chapa payment');
      }

      // Store the tx_ref in the payment intent's referenceNumber field
      // This is important for webhook lookup
      const { updatePaymentIntent } = await import('../payment-intent');
      await updatePaymentIntent(intent._id, {
        referenceNumber: txRef,
        redirectUrl: data.data.checkout_url,
        providerMetadata: {
          provider: 'chapa',
          intentId: intent._id,
          txRef,
          chapaTransactionId: data.data.id,
        },
      });

      return {
        redirectUrl: data.data.checkout_url,
        referenceNumber: txRef,
        metadata: {
          provider: 'chapa',
          intentId: intent._id,
          txRef,
          chapaTransactionId: data.data.id,
        },
      };
    } catch (error) {
      console.error('[Chapa] Payment initiation error:', error);
      throw new Error(
        error instanceof Error
          ? `Failed to initiate Chapa payment: ${error.message}`
          : 'Failed to initiate Chapa payment',
      );
    }
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentVerificationResult> {
    console.log(`[Chapa] Verifying payment:`, { reference, metadata });

    // If no secret key, return mock verification
    if (!this.secretKey || this.isTestMode) {
      return {
        success: true,
        referenceNumber: reference,
        ...(metadata?.amount !== undefined ? { amount: metadata.amount as number } : {}),
        metadata: {
          mock: true,
          provider: 'chapa',
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    try {
      // Call Chapa API to verify transaction
      const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          referenceNumber: reference,
          error: errorData.message || `Chapa API error: ${response.status}`,
        };
      }

      const data = await response.json();

      if (data.status !== 'success' || !data.data) {
        return {
          success: false,
          referenceNumber: reference,
          error: data.message || 'Transaction verification failed',
        };
      }

      const transaction = data.data;

      // Check transaction status
      const isSuccessful = transaction.status === 'successful' || transaction.status === 'success';

      return {
        success: isSuccessful,
        referenceNumber: reference,
        amount: parseFloat(transaction.amount || '0'),
        metadata: {
          provider: 'chapa',
          transactionId: transaction.id,
          status: transaction.status,
          currency: transaction.currency,
          verifiedAt: new Date().toISOString(),
          customer: transaction.customer,
        },
        error: isSuccessful ? undefined : `Transaction status: ${transaction.status}`,
      };
    } catch (error) {
      console.error('[Chapa] Payment verification error:', error);
      return {
        success: false,
        referenceNumber: reference,
        error: error instanceof Error ? error.message : 'Failed to verify payment',
      };
    }
  }

  /**
   * Verify webhook signature from Chapa.
   * Chapa sends webhooks with HMAC signature in headers.
   */
  verifyWebhookSignature(
    payload: string | object,
    signature: string,
    secret: string = this.secretKey || '',
  ): boolean {
    if (!secret) {
      console.warn('[Chapa] No webhook secret configured, skipping signature verification');
      return true; // Allow in development
    }

    try {
      const crypto = require('crypto');
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      console.error('[Chapa] Webhook signature verification error:', error);
      return false;
    }
  }
}
