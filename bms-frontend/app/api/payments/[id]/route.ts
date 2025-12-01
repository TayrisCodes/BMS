import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findPaymentById,
  updatePayment,
  refundPayment,
  type Payment,
  type PaymentStatus,
} from '@/lib/payments/payments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/payments/[id]
 * Get a single payment by ID.
 * Requires payments.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read payments
    requirePermission(context, 'payments', 'read');

    const payment = await findPaymentById(id, context.organizationId || undefined);

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, payment.organizationId);

    return NextResponse.json({
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
        organizationId: payment.organizationId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get payment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while fetching payment' }, { status: 500 });
  }
}

/**
 * PATCH /api/payments/[id]
 * Update a payment.
 * Requires payments.update permission.
 * Only pending payments can be modified, or status can be updated.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update payments (ACCOUNTANT) or reconcile (ORG_ADMIN, ACCOUNTANT)
    try {
      requirePermission(context, 'payments', 'update');
    } catch {
      requirePermission(context, 'payments', 'reconcile');
    }

    // Get existing payment to validate organization access
    const existingPayment = await findPaymentById(id, context.organizationId || undefined);

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingPayment.organizationId);

    const body = (await request.json()) as Partial<Payment>;

    const updates: Partial<Payment> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    try {
      const updatedPayment = await updatePayment(id, updates);

      if (!updatedPayment) {
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Payment updated successfully',
        payment: {
          _id: updatedPayment._id,
          invoiceId: updatedPayment.invoiceId,
          tenantId: updatedPayment.tenantId,
          amount: updatedPayment.amount,
          paymentMethod: updatedPayment.paymentMethod,
          paymentDate: updatedPayment.paymentDate,
          referenceNumber: updatedPayment.referenceNumber,
          status: updatedPayment.status,
          providerResponse: updatedPayment.providerResponse,
          notes: updatedPayment.notes,
          createdBy: updatedPayment.createdBy,
          organizationId: updatedPayment.organizationId,
          createdAt: updatedPayment.createdAt,
          updatedAt: updatedPayment.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only pending payments can be modified')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
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
    console.error('Update payment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while updating payment' }, { status: 500 });
  }
}

/**
 * DELETE /api/payments/[id]
 * Refund a payment (sets status to refunded, updates linked invoice if needed).
 * Requires payments.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to refund payments (ORG_ADMIN, ACCOUNTANT can reconcile)
    requirePermission(context, 'payments', 'reconcile');

    // Get existing payment to validate organization access
    const existingPayment = await findPaymentById(id, context.organizationId || undefined);

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingPayment.organizationId);

    try {
      const refundedPayment = await refundPayment(id);

      if (!refundedPayment) {
        return NextResponse.json({ error: 'Failed to refund payment' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Payment refunded successfully',
        payment: {
          _id: refundedPayment._id,
          status: refundedPayment.status,
          updatedAt: refundedPayment.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only completed payments can be refunded')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Refund payment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while refunding payment' },
      { status: 500 },
    );
  }
}
