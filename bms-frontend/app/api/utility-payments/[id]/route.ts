import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findUtilityPaymentById,
  updateUtilityPayment,
  deleteUtilityPayment,
  type UtilityPayment,
} from '@/lib/utilities/utility-payments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/utility-payments/[id]
 * Get a single utility payment by ID.
 * Requires utilities.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read utilities
    try {
      requirePermission(context, 'utilities', 'read');
    } catch {
      // Fallback: Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to read utility payments
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const payment = await findUtilityPaymentById(id, context.organizationId || undefined);

    if (!payment) {
      return NextResponse.json({ error: 'Utility payment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, payment.organizationId);

    return NextResponse.json({
      utilityPayment: {
        _id: payment._id,
        organizationId: payment.organizationId,
        meterId: payment.meterId,
        utilityType: payment.utilityType,
        periodStart: payment.periodStart,
        periodEnd: payment.periodEnd,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        receiptUrl: payment.receiptUrl,
        receiptFileName: payment.receiptFileName,
        notes: payment.notes,
        createdBy: payment.createdBy,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get utility payment error', error);
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
      { error: 'Unexpected error while fetching utility payment' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/utility-payments/[id]
 * Update a utility payment.
 * Requires utilities.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update utilities
    try {
      requirePermission(context, 'utilities', 'update');
    } catch {
      // Fallback: Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to update utility payments
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing payment to validate organization access
    const existingPayment = await findUtilityPaymentById(id, context.organizationId || undefined);

    if (!existingPayment) {
      return NextResponse.json({ error: 'Utility payment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingPayment.organizationId);

    const body = (await request.json()) as Partial<UtilityPayment>;

    const updates: Partial<UtilityPayment> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    try {
      const updatedPayment = await updateUtilityPayment(id, updates);

      if (!updatedPayment) {
        return NextResponse.json({ error: 'Failed to update utility payment' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Utility payment updated successfully',
        utilityPayment: {
          _id: updatedPayment._id,
          organizationId: updatedPayment.organizationId,
          meterId: updatedPayment.meterId,
          utilityType: updatedPayment.utilityType,
          periodStart: updatedPayment.periodStart,
          periodEnd: updatedPayment.periodEnd,
          amount: updatedPayment.amount,
          paymentDate: updatedPayment.paymentDate,
          paymentMethod: updatedPayment.paymentMethod,
          receiptUrl: updatedPayment.receiptUrl,
          receiptFileName: updatedPayment.receiptFileName,
          notes: updatedPayment.notes,
          createdBy: updatedPayment.createdBy,
          createdAt: updatedPayment.createdAt,
          updatedAt: updatedPayment.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('Meter not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update utility payment error', error);
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
      { error: 'Unexpected error while updating utility payment' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/utility-payments/[id]
 * Delete a utility payment.
 * Requires utilities.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete utilities
    try {
      requirePermission(context, 'utilities', 'delete');
    } catch {
      // Fallback: Allow ORG_ADMIN to delete utility payments
      if (!context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing payment to validate organization access
    const existingPayment = await findUtilityPaymentById(id, context.organizationId || undefined);

    if (!existingPayment) {
      return NextResponse.json({ error: 'Utility payment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingPayment.organizationId);

    try {
      const deleted = await deleteUtilityPayment(id, context.organizationId || undefined);

      if (!deleted) {
        return NextResponse.json({ error: 'Failed to delete utility payment' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Utility payment deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Delete utility payment error', error);
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
      { error: 'Unexpected error while deleting utility payment' },
      { status: 500 },
    );
  }
}

