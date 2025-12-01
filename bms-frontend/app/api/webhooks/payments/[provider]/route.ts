import { NextResponse } from 'next/server';
import {
  findPaymentIntentByReference,
  updatePaymentIntent,
} from '@/modules/payments/payment-intent';
import { getPaymentProvider } from '@/modules/payments/providers';
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
    const body = await request.json();

    console.log(`[Webhook] Received payment callback from ${provider}:`, {
      provider,
      body: JSON.stringify(body),
      timestamp: new Date().toISOString(),
    });

    // Validate provider
    const validProviders = ['telebirr', 'cbe_birr', 'chapa', 'hellocash', 'bank_transfer'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: `Invalid payment provider: ${provider}` }, { status: 400 });
    }

    // Extract reference number from webhook payload
    // This will vary by provider - adjust based on actual webhook format
    const referenceNumber =
      body.reference || body.transactionId || body.paymentReference || body.ref;

    if (!referenceNumber) {
      return NextResponse.json(
        { error: 'Missing payment reference in webhook payload' },
        { status: 400 },
      );
    }

    // TODO: Verify webhook signature
    // In production, verify the webhook signature using provider's secret key
    // const isValid = verifyWebhookSignature(provider, body, request.headers);
    // if (!isValid) {
    //   return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    // }

    // Find payment intent by reference
    const intent = await findPaymentIntentByReference(referenceNumber);

    if (!intent) {
      console.warn(`[Webhook] Payment intent not found for reference: ${referenceNumber}`);
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
    });

    // Note: Invoice status update is handled automatically by createPayment function
    // when payment status is "completed" and total paid >= invoice total

    // TODO: Send notification to tenant
    // await sendNotification(intent.tenantId, {
    //   type: "payment_completed",
    //   message: `Payment of ${intent.currency} ${payment.amount} completed successfully`,
    // });

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
