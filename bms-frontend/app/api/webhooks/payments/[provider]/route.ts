import { NextResponse } from 'next/server';
import {
  findPaymentIntentByReference,
  updatePaymentIntent,
} from '@/modules/payments/payment-intent';
import { getPaymentProvider } from '@/modules/payments/providers';
import { ChapaProvider } from '@/modules/payments/providers/chapa';
import { createPayment } from '@/lib/payments/payments';
import { findInvoiceById, updateInvoice } from '@/lib/invoices/invoices';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

/**
 * Webhook handler for payment provider callbacks.
 *
 * This endpoint receives callbacks from payment providers (Telebirr, CBE Birr, Chapa, HelloCash)
 * when a payment is completed, failed, or needs verification.
 *
 * For MVP, this is a placeholder structure. In production:
 * - Verify webhook signature for security
 * - Handle idempotency (prevent duplicate processing)
 * - Update payment intent status
 * - Create payment record
 * - Update invoice status
 * - Send notifications
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const { provider } = await routeParams.params;

    // Validate provider
    const validProviders = ['telebirr', 'cbe_birr', 'chapa', 'hellocash', 'bank_transfer'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: `Invalid payment provider: ${provider}` }, { status: 400 });
    }

    // For Chapa, we need to read raw body for signature verification
    let body: any;
    let rawBody: string | null = null;

    if (provider === 'chapa') {
      // Read raw body for signature verification
      rawBody = await request.text();
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      }

      // Verify Chapa webhook signature
      const signature =
        request.headers.get('x-chapa-signature') || request.headers.get('X-Chapa-Signature');
      if (signature) {
        const chapaProvider = new ChapaProvider();
        const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY;

        if (webhookSecret) {
          const isValid = chapaProvider.verifyWebhookSignature(rawBody, signature, webhookSecret);

          if (!isValid) {
            console.error('[Webhook] Invalid Chapa webhook signature');
            return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
          }
        }
      }
    } else {
      // For other providers, read as JSON
      body = await request.json();
    }

    console.log(`[Webhook] Received payment callback from ${provider}:`, {
      provider,
      body: JSON.stringify(body),
      timestamp: new Date().toISOString(),
    });

    // Extract reference number from webhook payload
    // Chapa uses 'tx_ref' in the webhook payload
    let referenceNumber: string | null = null;

    if (provider === 'chapa') {
      // Chapa webhook format: { tx_ref, status, ... }
      referenceNumber = body.tx_ref || body.reference || null;
    } else {
      // Other providers
      referenceNumber =
        body.reference || body.transactionId || body.paymentReference || body.ref || null;
    }

    if (!referenceNumber) {
      return NextResponse.json(
        { error: 'Missing payment reference in webhook payload' },
        { status: 400 },
      );
    }

    // Find payment intent by reference
    // For Chapa, the reference (tx_ref) should be stored in referenceNumber field
    const intent = await findPaymentIntentByReference(referenceNumber);

    if (!intent) {
      console.warn(`[Webhook] Payment intent not found for reference: ${referenceNumber}`);
      // For Chapa, log the full payload for debugging
      if (provider === 'chapa') {
        console.log('[Webhook] Chapa webhook payload:', JSON.stringify(body, null, 2));
      }
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
    }

    // Get payment provider and verify payment
    const paymentProvider = getPaymentProvider(intent.provider as any);
    const verificationResult = await paymentProvider.verifyPayment(referenceNumber, body);

    if (!verificationResult.success) {
      // Update intent status to failed
      await updatePaymentIntent(intent._id, {
        status: 'failed',
        providerMetadata: {
          ...intent.providerMetadata,
          webhookPayload: body,
          verificationError: verificationResult.error,
        },
      });

      return NextResponse.json({
        message: 'Payment verification failed',
        intentId: intent._id,
        status: 'failed',
      });
    }

    // Payment verified successfully
    // Update payment intent status
    await updatePaymentIntent(intent._id, {
      status: 'completed',
      providerMetadata: {
        ...intent.providerMetadata,
        webhookPayload: body,
        verifiedAt: new Date().toISOString(),
      },
    });

    // Map payment provider to payment method
    const paymentMethodMap: Record<
      string,
      'telebirr' | 'cbe_birr' | 'chapa' | 'hellocash' | 'bank_transfer' | 'cash' | 'other'
    > = {
      telebirr: 'telebirr',
      cbe_birr: 'cbe_birr',
      chapa: 'chapa',
      hellocash: 'hellocash',
      bank_transfer: 'bank_transfer',
    };

    const paymentMethod = paymentMethodMap[intent.provider] || 'other';

    // Create payment record
    const payment = await createPayment({
      organizationId: intent.organizationId,
      tenantId: intent.tenantId,
      invoiceId: intent.invoiceId || null,
      amount: verificationResult.amount || intent.amount,
      paymentMethod,
      paymentDate: new Date(),
      referenceNumber: referenceNumber,
      status: 'completed',
      providerResponse: {
        ...verificationResult.metadata,
        intentId: intent._id,
        provider: intent.provider,
        webhookPayload: body,
      },
      providerTransactionId: verificationResult.transactionId || null,
      currency: intent.currency || 'ETB',
    });

    // Generate receipt URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL}`
        : 'http://localhost:3000';
    const receiptUrl = `${baseUrl}/api/payments/${payment._id}/receipt`;

    // Update payment with receipt URL
    const { updatePayment } = await import('@/lib/payments/payments');
    await updatePayment(payment._id, {
      receiptUrl,
    }).catch((error) => {
      console.error('[Webhook] Failed to update payment with receipt URL:', error);
      // Don't fail the webhook if receipt URL update fails
    });

    // Note: Invoice status update is handled automatically by createPayment function
    // when payment status is "completed" and total paid >= invoice total

    // Send notification to tenant
    try {
      const { notificationService } = await import('@/modules/notifications/notification-service');
      await notificationService.createNotification({
        organizationId: intent.organizationId,
        tenantId: intent.tenantId,
        type: 'payment_completed',
        title: 'Payment Completed',
        message: `Your payment of ${intent.currency || 'ETB'} ${payment.amount.toLocaleString()} has been processed successfully.`,
        channels: ['in_app', 'email', 'sms'],
        link: `/tenant/payments`,
        metadata: {
          paymentId: payment._id,
          amount: payment.amount,
          invoiceId: intent.invoiceId,
          receiptUrl,
        },
      });
    } catch (notifError) {
      console.error('[Webhook] Failed to send payment notification:', notifError);
      // Don't fail the webhook if notification fails
    }

    console.log(`[Webhook] Payment processed successfully:`, {
      intentId: intent._id,
      paymentId: payment._id,
      referenceNumber,
    });

    return NextResponse.json({
      message: 'Payment processed successfully',
      intentId: intent._id,
      paymentId: payment._id,
      status: 'completed',
    });
  } catch (error) {
    console.error(`[Webhook] Error processing payment callback:`, error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to process payment webhook' }, { status: 500 });
  }
}

/**
 * GET endpoint for webhook verification (some providers require this)
 */
export async function GET(request: Request, routeParams: RouteParams) {
  const { provider } = await routeParams.params;

  // Some providers require GET endpoint for webhook verification
  // Return a simple response
  return NextResponse.json({
    message: `Webhook endpoint for ${provider} is active`,
    provider,
  });
}
