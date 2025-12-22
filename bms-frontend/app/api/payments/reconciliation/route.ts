import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { getPaymentsCollection } from '@/lib/payments/payments';
import { updatePayment } from '@/lib/payments/payments';

/**
 * GET /api/payments/reconciliation
 * List payments that need reconciliation.
 * Requires payments.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read payments
    requirePermission(context, 'payments', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending'; // pending, reconciled, disputed
    const paymentMethod = searchParams.get('method');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const collection = await getPaymentsCollection();

    // Build query
    const query: Record<string, unknown> = {
      organizationId,
      reconciliationStatus: status,
      status: 'completed', // Only completed payments need reconciliation
    };

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Get payments needing reconciliation
    const payments = await collection
      .find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      payments: payments.map((payment) => ({
        _id: payment._id,
        invoiceId: payment.invoiceId,
        tenantId: payment.tenantId,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate,
        referenceNumber: payment.referenceNumber,
        providerTransactionId: payment.providerTransactionId,
        reconciliationStatus: payment.reconciliationStatus,
        notes: payment.notes,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
      count: payments.length,
    });
  } catch (error) {
    console.error('Get reconciliation payments error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching reconciliation payments' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/payments/reconciliation/bulk
 * Bulk reconcile multiple payments.
 * Requires payments.update permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

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
      paymentIds: string[];
      bankStatementReference?: string | null;
      reconciliationNotes?: string | null;
    };

    if (!body.paymentIds || !Array.isArray(body.paymentIds) || body.paymentIds.length === 0) {
      return NextResponse.json(
        { error: 'paymentIds array is required and must not be empty' },
        { status: 400 },
      );
    }

    const results: Array<{ paymentId: string; success: boolean; error?: string }> = [];

    // Reconcile each payment
    for (const paymentId of body.paymentIds) {
      try {
        // Get existing payment first
        const { findPaymentById } = await import('@/lib/payments/payments');
        const existingPayment = await findPaymentById(paymentId, organizationId);

        if (!existingPayment) {
          results.push({ paymentId, success: false, error: 'Payment not found' });
          continue;
        }

        const updatedProviderResponse = {
          ...((existingPayment.providerResponse as Record<string, unknown>) || {}),
          bankStatementReference: body.bankStatementReference || null,
          reconciledAt: new Date().toISOString(),
          reconciledBy: context.userId || null,
        };

        const payment = await updatePayment(paymentId, {
          reconciliationStatus: 'reconciled',
          notes: body.reconciliationNotes
            ? `[Bulk Reconciliation] ${body.reconciliationNotes}`
            : (existingPayment.notes ?? null),
          providerResponse: updatedProviderResponse,
        });

        if (payment) {
          // Update invoice status if needed
          if (payment.invoiceId && payment.status === 'completed') {
            try {
              const { findInvoiceById } = await import('@/lib/invoices/invoices');
              const { findPaymentsByInvoice } = await import('@/lib/payments/payments');
              const { updateInvoiceStatus } = await import('@/lib/invoices/invoices');

              const invoice = await findInvoiceById(payment.invoiceId, organizationId);
              if (invoice) {
                const allPayments = await findPaymentsByInvoice(payment.invoiceId, organizationId);
                const totalPaid = allPayments
                  .filter((p) => p.status === 'completed')
                  .reduce((sum, p) => sum + p.amount, 0);

                if (totalPaid >= invoice.total && invoice.status !== 'paid') {
                  await updateInvoiceStatus(payment.invoiceId, 'paid', payment.paymentDate);
                }
              }
            } catch (error) {
              console.error(`Failed to update invoice for payment ${paymentId}:`, error);
            }
          }

          results.push({ paymentId, success: true });
        } else {
          results.push({ paymentId, success: false, error: 'Failed to update payment' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ paymentId, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Bulk reconciliation completed: ${successCount} succeeded, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    console.error('Bulk reconcile payments error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while bulk reconciling payments' },
      { status: 500 },
    );
  }
}
