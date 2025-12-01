import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { getUnitsCollection, createUnit, listUnits, type CreateUnitInput } from '@/lib/units/units';

/**
 * GET /api/units
 * List units with optional filters.
 * Requires units.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read units
    requirePermission(context, 'units', 'read');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const status = searchParams.get('status');
    const unitType = searchParams.get('unitType');
    const search = searchParams.get('search'); // For unit number search

    // Build query with organization scope
    const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

    // Add filters
    if (buildingId) {
      baseQuery.buildingId = buildingId;
    }

    if (status) {
      baseQuery.status = status;
    }

    if (unitType) {
      baseQuery.unitType = unitType;
    }

    // Search by unit number
    if (search) {
      baseQuery.unitNumber = { $regex: search.trim(), $options: 'i' };
    }

    const units = await listUnits(baseQuery);

    return NextResponse.json({
      units: units.map((u) => ({
        _id: u._id,
        buildingId: u.buildingId,
        unitNumber: u.unitNumber,
        floor: u.floor,
        unitType: u.unitType,
        area: u.area,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        status: u.status,
        rentAmount: u.rentAmount,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      count: units.length,
    });
  } catch (error) {
    console.error('Get units error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching units' }, { status: 500 });
  }
}

/**
 * POST /api/units
 * Create a new unit.
 * Requires units.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create units
    requirePermission(context, 'units', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateUnitInput>;

    // Validate required fields
    if (!body.buildingId || !body.unitNumber || !body.unitType) {
      return NextResponse.json(
        { error: 'buildingId, unitNumber, and unitType are required' },
        { status: 400 },
      );
    }

    // Create unit
    const input: CreateUnitInput = {
      organizationId,
      buildingId: body.buildingId,
      unitNumber: body.unitNumber,
      floor: body.floor ?? null,
      unitType: body.unitType,
      area: body.area ?? null,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      status: body.status ?? 'available',
      rentAmount: body.rentAmount ?? null,
    };

    try {
      const unit = await createUnit(input);

      return NextResponse.json(
        {
          message: 'Unit created successfully',
          unit: {
            _id: unit._id,
            buildingId: unit.buildingId,
            unitNumber: unit.unitNumber,
            floor: unit.floor,
            unitType: unit.unitType,
            area: unit.area,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            status: unit.status,
            rentAmount: unit.rentAmount,
            createdAt: unit.createdAt,
            updatedAt: unit.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists in this building')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create unit error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Unit number already exists in this building' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating unit' }, { status: 500 });
  }
}
