import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getMetersCollection,
  createMeter,
  listMeters,
  findMetersByBuilding,
  findMetersByUnit,
  type CreateMeterInput,
  type MeterType,
  type MeterStatus,
} from '@/lib/meters/meters';

/**
 * GET /api/meters
 * List meters with optional filters.
 * Requires meters.read or utilities.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read meters
    try {
      requirePermission(context, 'utilities', 'read');
    } catch {
      // Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to read meters
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const unitId = searchParams.get('unitId');
    const meterType = searchParams.get('meterType') as MeterType | null;
    const status = searchParams.get('status') as MeterStatus | null;

    let meters;

    // If buildingId is specified, use findMetersByBuilding
    if (buildingId) {
      meters = await findMetersByBuilding(buildingId, context.organizationId || undefined);
    }
    // If unitId is specified, use findMetersByUnit
    else if (unitId) {
      meters = await findMetersByUnit(unitId, context.organizationId || undefined);
    }
    // Otherwise, list all meters with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (meterType) {
        baseQuery.meterType = meterType;
      }
      if (status) {
        baseQuery.status = status;
      }
      if (buildingId) {
        baseQuery.buildingId = buildingId;
      }
      if (unitId) {
        baseQuery.unitId = unitId;
      }

      meters = await listMeters(baseQuery);
    }

    // Apply additional filters if provided (in case they were used with buildingId/unitId)
    if (meterType) {
      meters = meters.filter((m) => m.meterType === meterType);
    }
    if (status) {
      meters = meters.filter((m) => m.status === status);
    }

    return NextResponse.json({
      meters: meters.map((m) => ({
        _id: m._id,
        organizationId: m.organizationId,
        buildingId: m.buildingId,
        unitId: m.unitId,
        assetId: m.assetId,
        meterType: m.meterType,
        meterNumber: m.meterNumber,
        unit: m.unit,
        installationDate: m.installationDate,
        status: m.status,
        lastReading: m.lastReading,
        lastReadingDate: m.lastReadingDate,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      count: meters.length,
    });
  } catch (error) {
    console.error('Get meters error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching meters' }, { status: 500 });
  }
}

/**
 * POST /api/meters
 * Create a new meter.
 * Requires FACILITY_MANAGER or ORG_ADMIN role.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create meters
    // FACILITY_MANAGER or ORG_ADMIN can create
    try {
      requirePermission(context, 'utilities', 'create');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('FACILITY_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateMeterInput>;

    // Validate required fields
    if (
      !body.buildingId ||
      !body.meterType ||
      !body.meterNumber ||
      !body.unit ||
      !body.installationDate
    ) {
      return NextResponse.json(
        {
          error: 'buildingId, meterType, meterNumber, unit, and installationDate are required',
        },
        { status: 400 },
      );
    }

    // Create meter
    const input: CreateMeterInput = {
      organizationId,
      buildingId: body.buildingId,
      unitId: body.unitId ?? null,
      assetId: body.assetId ?? null,
      meterType: body.meterType,
      meterNumber: body.meterNumber,
      unit: body.unit,
      installationDate: new Date(body.installationDate),
      status: body.status ?? 'active',
      lastReading: body.lastReading ?? null,
      lastReadingDate: body.lastReadingDate ? new Date(body.lastReadingDate) : null,
    };

    try {
      const meter = await createMeter(input);

      return NextResponse.json(
        {
          message: 'Meter created successfully',
          meter: {
            _id: meter._id,
            organizationId: meter.organizationId,
            buildingId: meter.buildingId,
            unitId: meter.unitId,
            assetId: meter.assetId,
            meterType: meter.meterType,
            meterNumber: meter.meterNumber,
            unit: meter.unit,
            installationDate: meter.installationDate,
            status: meter.status,
            lastReading: meter.lastReading,
            lastReadingDate: meter.lastReadingDate,
            createdAt: meter.createdAt,
            updatedAt: meter.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Unit not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message.includes('are required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create meter error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating meter' }, { status: 500 });
  }
}
