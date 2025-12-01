import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getLeasesCollection,
  createLease,
  listLeases,
  findLeasesByTenant,
  findLeasesByUnit,
  type CreateLeaseInput,
} from '@/lib/leases/leases';
import { findBuildingById } from '@/lib/buildings/buildings';

/**
 * GET /api/leases
 * List leases with optional filters.
 * Requires leases.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read leases
    requirePermission(context, 'leases', 'read');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const unitId = searchParams.get('unitId');
    const buildingId = searchParams.get('buildingId');
    const status = searchParams.get('status');

    let leases: Awaited<ReturnType<typeof listLeases>>;

    // If tenantId is specified, use findLeasesByTenant
    if (tenantId) {
      leases = await findLeasesByTenant(tenantId, context.organizationId || undefined);
      // Apply additional filters
      if (status) {
        leases = leases.filter((l) => l.status === status);
      }
    }
    // If unitId is specified, use findLeasesByUnit
    else if (unitId) {
      leases = await findLeasesByUnit(unitId, context.organizationId || undefined);
      // Apply additional filters
      if (status) {
        leases = leases.filter((l) => l.status === status);
      }
    }
    // Otherwise, list all leases with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (status) {
        baseQuery.status = status;
      }

      // If buildingId is specified, we need to find units in that building first
      // For now, we'll filter after fetching (can be optimized later with aggregation)
      leases = await listLeases(baseQuery);

      if (buildingId) {
        // Validate building belongs to same org
        const building = await findBuildingById(buildingId, context.organizationId || undefined);
        if (building && building.organizationId === context.organizationId) {
          // Get all units in this building
          const { findUnitsByBuilding } = await import('@/lib/units/units');
          const units = await findUnitsByBuilding(buildingId);
          const unitIds = units.map((u) => String(u._id));
          leases = leases.filter((l) => unitIds.includes(String(l.unitId)));
        } else {
          leases = [];
        }
      }
    }

    return NextResponse.json({
      leases: leases.map((l) => ({
        _id: l._id,
        tenantId: l.tenantId,
        unitId: l.unitId,
        startDate: l.startDate,
        endDate: l.endDate,
        rentAmount: l.rentAmount,
        depositAmount: l.depositAmount,
        billingCycle: l.billingCycle,
        dueDay: l.dueDay,
        additionalCharges: l.additionalCharges,
        status: l.status,
        terminationDate: l.terminationDate,
        terminationReason: l.terminationReason,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
      count: leases.length,
    });
  } catch (error) {
    console.error('Get leases error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching leases' }, { status: 500 });
  }
}

/**
 * POST /api/leases
 * Create a new lease.
 * Requires leases.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create leases
    requirePermission(context, 'leases', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateLeaseInput>;

    // Validate required fields
    if (
      !body.tenantId ||
      !body.unitId ||
      !body.startDate ||
      !body.rentAmount ||
      !body.billingCycle ||
      body.dueDay === undefined
    ) {
      return NextResponse.json(
        {
          error: 'tenantId, unitId, startDate, rentAmount, billingCycle, and dueDay are required',
        },
        { status: 400 },
      );
    }

    // Create lease
    const input: CreateLeaseInput = {
      organizationId,
      tenantId: body.tenantId,
      unitId: body.unitId,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      rentAmount: body.rentAmount,
      depositAmount: body.depositAmount ?? null,
      billingCycle: body.billingCycle,
      dueDay: body.dueDay,
      additionalCharges: body.additionalCharges ?? null,
      status: body.status ?? 'active',
    };

    try {
      const lease = await createLease(input);

      return NextResponse.json(
        {
          message: 'Lease created successfully',
          lease: {
            _id: lease._id,
            tenantId: lease.tenantId,
            unitId: lease.unitId,
            startDate: lease.startDate,
            endDate: lease.endDate,
            rentAmount: lease.rentAmount,
            depositAmount: lease.depositAmount,
            billingCycle: lease.billingCycle,
            dueDay: lease.dueDay,
            additionalCharges: lease.additionalCharges,
            status: lease.status,
            terminationDate: lease.terminationDate,
            terminationReason: lease.terminationReason,
            createdAt: lease.createdAt,
            updatedAt: lease.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Tenant not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Unit not found')) {
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
    console.error('Create lease error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating lease' }, { status: 500 });
  }
}
