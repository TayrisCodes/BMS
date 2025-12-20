import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { PaymentIntentService } from '@/modules/payments/payment-intent-service';
import type { PaymentProvider } from '@/modules/payments/payment-intent';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/pay/chapa
 * Initiate Chapa payment for an invoice.
 * Requires invoices.read and payments.create permissions.
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id: invoiceId } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read invoices and create payments
    requirePermission(context, 'invoices', 'read');
    requirePermission(context, 'payments', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Fetch invoice
    const invoice = await findInvoiceById(invoiceId, organizationId);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate invoice belongs to organization
    if (invoice.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Invoice does not belong to your organization' },
        { status: 403 },
      );
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    // Calculate remaining balance
    const { findPaymentsByInvoice } = await import('@/lib/payments/payments');
    const payments = await findPaymentsByInvoice(invoiceId, organizationId);
    const totalPaid = payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = invoice.total - totalPaid;

    if (remainingBalance <= 0) {
      return NextResponse.json({ error: 'Invoice is fully paid' }, { status: 400 });
    }

    // Create and initiate Chapa payment intent
    const { intent, result } = await PaymentIntentService.createAndInitiatePayment({
      invoiceId: invoiceId,
      tenantId: invoice.tenantId,
      organizationId,
      amount: remainingBalance, // Pay remaining balance
      currency: 'ETB',
      provider: 'chapa',
    });

    return NextResponse.json({
      success: true,
      intentId: intent._id,
      status: intent.status,
      redirectUrl: result.redirectUrl,
      paymentInstructions: result.paymentInstructions,
      referenceNumber: result.referenceNumber,
      amount: remainingBalance,
      message: 'Chapa payment initiated successfully',
    });
  } catch (error) {
    console.error('Initiate Chapa payment error', error);

    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('not enabled') || error.message.includes('Chapa')) {
        return NextResponse.json(
          { error: 'Chapa payment is not available. Please check configuration.' },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to initiate Chapa payment. Please try again later.' },
      { status: 500 },
    );
  }
}

