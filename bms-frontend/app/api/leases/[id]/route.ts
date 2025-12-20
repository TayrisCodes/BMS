import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findLeaseById, updateLease, terminateLease, type Lease } from '@/lib/leases/leases';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leases/[id]
 * Get a single lease by ID.
 * Requires leases.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read leases
    requirePermission(context, 'leases', 'read');

    const lease = await findLeaseById(id, context.organizationId || undefined);

    if (!lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, lease.organizationId);

    return NextResponse.json({
      lease: {
        _id: lease._id,
        tenantId: lease.tenantId,
        unitId: lease.unitId,
        buildingId: lease.buildingId,
        startDate: lease.startDate,
        endDate: lease.endDate,
        billingCycle: lease.billingCycle,
        dueDay: lease.dueDay,
        rentAmount: lease.rentAmount ?? lease.terms?.rent,
        depositAmount: lease.depositAmount ?? lease.terms?.deposit,
        terms: lease.terms,
        additionalCharges: lease.additionalCharges,
        penaltyConfig: lease.penaltyConfig,
        paymentDueDays: lease.paymentDueDays,
        renewalNoticeDays: lease.renewalNoticeDays,
        documents: lease.documents,
        termsTemplateId: lease.termsTemplateId,
        customTermsText: lease.customTermsText,
        termsAccepted: lease.termsAccepted,
        nextInvoiceDate: lease.nextInvoiceDate,
        lastInvoicedAt: lease.lastInvoicedAt,
        status: lease.status,
        terminationDate: lease.terminationDate,
        terminationReason: lease.terminationReason,
        organizationId: lease.organizationId,
        createdAt: lease.createdAt,
        updatedAt: lease.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get lease error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching lease' }, { status: 500 });
  }
}

/**
 * PATCH /api/leases/[id]
 * Update a lease.
 * Requires leases.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update leases
    requirePermission(context, 'leases', 'update');

    // Get existing lease to validate organization access
    const existingLease = await findLeaseById(id, context.organizationId || undefined);

    if (!existingLease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingLease.organizationId);

    const body = (await request.json()) as Partial<Lease>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Lease> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // Validate dueDay if present
    if (updates.dueDay !== undefined && updates.dueDay !== null) {
      if (updates.dueDay < 1 || updates.dueDay > 31) {
        return NextResponse.json({ error: 'dueDay must be between 1 and 31' }, { status: 400 });
      }
    }

    try {
      const updatedLease = await updateLease(id, updates);

      if (!updatedLease) {
        return NextResponse.json({ error: 'Failed to update lease' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Lease updated successfully',
        lease: {
          _id: updatedLease._id,
          tenantId: updatedLease.tenantId,
          unitId: updatedLease.unitId,
          buildingId: updatedLease.buildingId,
          startDate: updatedLease.startDate,
          endDate: updatedLease.endDate,
          billingCycle: updatedLease.billingCycle,
          dueDay: updatedLease.dueDay,
          rentAmount: updatedLease.rentAmount ?? updatedLease.terms?.rent,
          depositAmount: updatedLease.depositAmount ?? updatedLease.terms?.deposit,
          terms: updatedLease.terms,
          additionalCharges: updatedLease.additionalCharges,
          penaltyConfig: updatedLease.penaltyConfig,
          paymentDueDays: updatedLease.paymentDueDays,
          renewalNoticeDays: updatedLease.renewalNoticeDays,
          documents: updatedLease.documents,
          termsTemplateId: updatedLease.termsTemplateId,
          customTermsText: updatedLease.customTermsText,
          termsAccepted: updatedLease.termsAccepted,
          nextInvoiceDate: updatedLease.nextInvoiceDate,
          lastInvoicedAt: updatedLease.lastInvoicedAt,
          status: updatedLease.status,
          terminationDate: updatedLease.terminationDate,
          terminationReason: updatedLease.terminationReason,
          organizationId: updatedLease.organizationId,
          createdAt: updatedLease.createdAt,
          updatedAt: updatedLease.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('Tenant not found') ||
          error.message.includes('Unit not found')
        ) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('already has an active lease')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update lease error', error);
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
    return NextResponse.json({ error: 'Unexpected error while updating lease' }, { status: 500 });
  }
}

/**
 * DELETE /api/leases/[id]
 * Terminate a lease (sets status to terminated, updates unit status).
 * Requires leases.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete/terminate leases
    requirePermission(context, 'leases', 'delete');

    // Get existing lease to validate organization access
    const existingLease = await findLeaseById(id, context.organizationId || undefined);

    if (!existingLease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingLease.organizationId);

    // Get termination reason from request body if provided
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason;

    const terminatedLease = await terminateLease(id, reason);

    if (!terminatedLease) {
      return NextResponse.json({ error: 'Failed to terminate lease' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Lease terminated successfully',
      lease: {
        _id: terminatedLease._id,
        status: terminatedLease.status,
        terminationDate: terminatedLease.terminationDate,
        terminationReason: terminatedLease.terminationReason,
        endDate: terminatedLease.endDate,
      },
    });
  } catch (error) {
    console.error('Terminate lease error', error);
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
      { error: 'Unexpected error while terminating lease' },
      { status: 500 },
    );
  }
}
