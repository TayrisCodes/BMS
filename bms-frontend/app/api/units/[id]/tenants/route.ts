import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findLeasesByUnit } from '@/lib/leases/leases';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUnitById } from '@/lib/units/units';

/**
 * GET /api/units/[id]/tenants
 * Get tenant history for a unit (current and previous tenants).
 * Requires units.read permission.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    requirePermission(context, 'units', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const unitId = params.id;

    // Verify unit exists and belongs to organization
    const unit = await findUnitById(unitId, organizationId);
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Get all leases for this unit (active, expired, terminated)
    const allLeases = await findLeasesByUnit(unitId, organizationId);

    // Sort leases by start date (newest first)
    allLeases.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });

    // Fetch tenant details for each lease
    const tenantHistory = await Promise.all(
      allLeases.map(async (lease) => {
        const tenant = await findTenantById(lease.tenantId, organizationId);
        return {
          lease: {
            _id: lease._id,
            startDate: lease.startDate,
            endDate: lease.endDate,
            terminationDate: lease.terminationDate,
            terminationReason: lease.terminationReason,
            rentAmount: lease.rentAmount,
            depositAmount: lease.depositAmount,
            billingCycle: lease.billingCycle,
            status: lease.status,
          },
          tenant: tenant
            ? {
                _id: tenant._id,
                firstName: tenant.firstName,
                lastName: tenant.lastName,
                primaryPhone: tenant.primaryPhone,
                email: tenant.email,
              }
            : null,
        };
      }),
    );

    // Separate current and previous tenants
    const now = new Date();
    const currentTenant = tenantHistory.find(
      (entry) =>
        entry.lease.status === 'active' &&
        (!entry.lease.endDate || new Date(entry.lease.endDate) >= now),
    );
    const previousTenants = tenantHistory.filter(
      (entry) =>
        entry.lease.status !== 'active' ||
        (entry.lease.endDate && new Date(entry.lease.endDate) < now),
    );

    return NextResponse.json({
      currentTenant: currentTenant || null,
      previousTenants,
      allHistory: tenantHistory,
    });
  } catch (error) {
    console.error('Get unit tenant history error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching tenant history' },
      { status: 500 },
    );
  }
}
