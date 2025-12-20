import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findPaymentById, updatePayment } from '@/lib/payments/payments';
import { updateInvoiceStatus } from '@/lib/invoices/invoices';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payments/[id]/reconcile
 * Manually reconcile a payment (typically for bank transfers).
 * Requires payments.update permission.
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update payments
    requirePermission(context, 'payments', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      bankStatementReference?: string | null;
      reconciliationNotes?: string | null;
    };

    // Get payment
    const payment = await findPaymentById(id, organizationId);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Update payment reconciliation status
    const updatedNotes = body.reconciliationNotes
      ? `${payment.notes || ''}\n[Reconciliation] ${body.reconciliationNotes}`.trim()
      : payment.notes;

    const updatedProviderResponse = {
      ...((payment.providerResponse as Record<string, unknown>) || {}),
      bankStatementReference: body.bankStatementReference || null,
      reconciledAt: new Date().toISOString(),
      reconciledBy: context.userId || null,
    };

    const updatedPayment = await updatePayment(id, {
      reconciliationStatus: 'reconciled',
      notes: updatedNotes || null,
      providerResponse: updatedProviderResponse,
    });

    if (!updatedPayment) {
      return NextResponse.json({ error: 'Failed to reconcile payment' }, { status: 500 });
    }

    // If payment is linked to an invoice and is completed, ensure invoice status is updated
    if (updatedPayment.invoiceId && updatedPayment.status === 'completed') {
      try {
        const { findInvoiceById } = await import('@/lib/invoices/invoices');
        const { findPaymentsByInvoice } = await import('@/lib/payments/payments');

        const invoice = await findInvoiceById(updatedPayment.invoiceId, organizationId);
        if (invoice) {
          const allPayments = await findPaymentsByInvoice(updatedPayment.invoiceId, organizationId);
          const totalPaid = allPayments
            .filter((p) => p.status === 'completed')
            .reduce((sum, p) => sum + p.amount, 0);

          if (totalPaid >= invoice.total && invoice.status !== 'paid') {
            await updateInvoiceStatus(updatedPayment.invoiceId, 'paid', updatedPayment.paymentDate);
          }
        }
      } catch (error) {
        console.error('Failed to update invoice status after reconciliation:', error);
        // Don't fail the request
      }
    }

    return NextResponse.json({
      message: 'Payment reconciled successfully',
      payment: {
        _id: updatedPayment._id,
        status: updatedPayment.status,
        reconciliationStatus: updatedPayment.reconciliationStatus,
        notes: updatedPayment.notes,
        updatedAt: updatedPayment.updatedAt,
      },
    });
  } catch (error) {
    console.error('Reconcile payment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while reconciling payment' },
      { status: 500 },
    );
  }
}
