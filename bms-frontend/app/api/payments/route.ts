import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createPayment,
  listPayments,
  findPaymentsByTenant,
  findPaymentsByInvoice,
  type CreatePaymentInput,
  type PaymentStatus,
} from '@/lib/payments/payments';

/**
 * GET /api/payments
 * List payments with optional filters.
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const invoiceId = searchParams.get('invoiceId');
    const status = searchParams.get('status') as PaymentStatus | null;
    const paymentDateFrom = searchParams.get('paymentDateFrom');
    const paymentDateTo = searchParams.get('paymentDateTo');

    let payments;

    // If tenantId is specified, use findPaymentsByTenant
    if (tenantId) {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      if (paymentDateFrom || paymentDateTo) {
        const dateFilter: { $gte?: Date; $lte?: Date } = {};
        if (paymentDateFrom) {
          dateFilter.$gte = new Date(paymentDateFrom);
        }
        if (paymentDateTo) {
          dateFilter.$lte = new Date(paymentDateTo);
        }
        filters.paymentDate = dateFilter;
      }
      payments = await findPaymentsByTenant(tenantId, context.organizationId || undefined, filters);
    }
    // If invoiceId is specified, use findPaymentsByInvoice
    else if (invoiceId) {
      payments = await findPaymentsByInvoice(invoiceId, context.organizationId || undefined);
      // Apply additional filters
      if (status) {
        payments = payments.filter((p) => p.status === status);
      }
    }
    // Otherwise, list all payments with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (status) {
        baseQuery.status = status;
      }

      if (paymentDateFrom || paymentDateTo) {
        const dateFilter: { $gte?: Date; $lte?: Date } = {};
        if (paymentDateFrom) {
          dateFilter.$gte = new Date(paymentDateFrom);
        }
        if (paymentDateTo) {
          dateFilter.$lte = new Date(paymentDateTo);
        }
        baseQuery.paymentDate = dateFilter;
      }

      payments = await listPayments(baseQuery);
    }

    return NextResponse.json({
      payments: payments.map((p) => ({
        _id: p._id,
        invoiceId: p.invoiceId,
        tenantId: p.tenantId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        referenceNumber: p.referenceNumber,
        status: p.status,
        providerResponse: p.providerResponse,
        notes: p.notes,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      count: payments.length,
    });
  } catch (error) {
    console.error('Get payments error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching payments' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/payments
 * Create a new payment.
 * Requires payments.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to record payments (ORG_ADMIN, BUILDING_MANAGER, ACCOUNTANT)
    requirePermission(context, 'payments', 'record');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreatePaymentInput>;

    // Validate required fields
    if (!body.tenantId || !body.amount || !body.paymentMethod || !body.paymentDate) {
      return NextResponse.json(
        {
          error: 'tenantId, amount, paymentMethod, and paymentDate are required',
        },
        { status: 400 },
      );
    }

    // Create payment
    const input: CreatePaymentInput = {
      organizationId,
      invoiceId: body.invoiceId ?? null,
      tenantId: body.tenantId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate,
      referenceNumber: body.referenceNumber ?? null,
      status: body.status ?? 'completed',
      providerResponse: body.providerResponse ?? null,
      notes: body.notes ?? null,
      createdBy: body.createdBy ?? context.userId ?? null,
    };

    try {
      const payment = await createPayment(input);

      // Trigger payment_received notification if payment is completed
      if (payment.status === 'completed') {
        try {
          const { notifyPaymentReceived } = await import('@/modules/notifications/events');
          await notifyPaymentReceived(
            payment._id,
            organizationId,
            payment.tenantId,
            payment.invoiceId || null,
            payment.amount,
          ).catch((error) => {
            console.error('[Payments API] Failed to send payment_received notification:', error);
            // Don't fail the payment creation if notification fails
          });
        } catch (error) {
          console.error('[Payments API] Error importing notification events:', error);
          // Don't fail the payment creation if notification import fails
        }
      }

      return NextResponse.json(
        {
          message: 'Payment created successfully',
          payment: {
            _id: payment._id,
            invoiceId: payment.invoiceId,
            tenantId: payment.tenantId,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate,
            referenceNumber: payment.referenceNumber,
            status: payment.status,
            providerResponse: payment.providerResponse,
            notes: payment.notes,
            createdBy: payment.createdBy,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Tenant not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Invoice not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists (idempotency check failed)')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create payment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating payment' }, { status: 500 });
  }
}
