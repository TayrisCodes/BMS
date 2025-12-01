import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createMeterReading,
  listMeterReadings,
  findMeterReadingsByMeter,
  calculateConsumption,
  type CreateMeterReadingInput,
  type MeterReadingSource,
} from '@/lib/meter-readings/meter-readings';

/**
 * GET /api/meter-readings
 * List meter readings with optional filters.
 * Requires meter-readings.read or utilities.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read meter readings
    try {
      requirePermission(context, 'utilities', 'read');
    } catch {
      // Allow FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN to read meter readings
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
    const meterId = searchParams.get('meterId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    let readings;

    // If meterId is specified, use findMeterReadingsByMeter
    if (meterId) {
      readings = await findMeterReadingsByMeter(
        meterId,
        context.organizationId || undefined,
        limit,
      );
    } else {
      // Otherwise, list all readings with organization scope
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add date filters if provided
      if (startDate || endDate) {
        const dateFilter: { $gte?: Date; $lte?: Date } = {};
        if (startDate) {
          dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
          dateFilter.$lte = new Date(endDate);
        }
        baseQuery.readingDate = dateFilter;
      }

      readings = await listMeterReadings(baseQuery);
    }

    // Apply date filters if provided (in case they were used without meterId)
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      readings = readings.filter((r) => {
        const date = new Date(r.readingDate);
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    // Apply limit if provided and not already applied
    if (limit && limit > 0 && !meterId) {
      readings = readings.slice(0, limit);
    }

    // If meterId and both startDate and endDate are provided, also calculate consumption
    let consumption: number | null = null;
    if (meterId && startDate && endDate) {
      try {
        consumption = await calculateConsumption(
          meterId,
          new Date(startDate),
          new Date(endDate),
          context.organizationId || undefined,
        );
      } catch (error) {
        // Ignore consumption calculation errors
        console.error('Error calculating consumption:', error);
      }
    }

    return NextResponse.json({
      readings: readings.map((r) => ({
        _id: r._id,
        organizationId: r.organizationId,
        meterId: r.meterId,
        reading: r.reading,
        readingDate: r.readingDate,
        readBy: r.readBy,
        source: r.source,
        notes: r.notes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      count: readings.length,
      ...(consumption !== null && { consumption }),
    });
  } catch (error) {
    console.error('Get meter readings error', error);
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
      { error: 'Unexpected error while fetching meter readings' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/meter-readings
 * Create a new meter reading.
 * Requires FACILITY_MANAGER, BUILDING_MANAGER, or ORG_ADMIN role.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create meter readings
    // FACILITY_MANAGER, BUILDING_MANAGER, or ORG_ADMIN can create
    try {
      requirePermission(context, 'utilities', 'create');
    } catch {
      // Check if user has appropriate role
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateMeterReadingInput>;

    // Validate required fields
    if (!body.meterId || body.reading === null || body.reading === undefined || !body.readingDate) {
      return NextResponse.json(
        {
          error: 'meterId, reading, and readingDate are required',
        },
        { status: 400 },
      );
    }

    // Create meter reading
    const input: CreateMeterReadingInput = {
      organizationId,
      meterId: body.meterId,
      reading: body.reading,
      readingDate: new Date(body.readingDate),
      readBy: body.readBy ?? context.userId,
      source: (body.source as MeterReadingSource) ?? 'manual',
      notes: body.notes ?? null,
      allowDecrease: body.allowDecrease ?? false,
    };

    try {
      const reading = await createMeterReading(input);

      return NextResponse.json(
        {
          message: 'Meter reading created successfully',
          reading: {
            _id: reading._id,
            organizationId: reading.organizationId,
            meterId: reading.meterId,
            reading: reading.reading,
            readingDate: reading.readingDate,
            readBy: reading.readBy,
            source: reading.source,
            notes: reading.notes,
            createdAt: reading.createdAt,
            updatedAt: reading.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Meter not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('must be greater than')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('must be a non-negative number')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('are required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create meter reading error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating meter reading' },
      { status: 500 },
    );
  }
}
