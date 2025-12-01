import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getParkingSpacesCollection,
  createParkingSpace,
  listParkingSpaces,
  findParkingSpacesByBuilding,
  type CreateParkingSpaceInput,
  type ParkingSpaceType,
  type ParkingSpaceStatus,
} from '@/lib/parking/parking-spaces';

/**
 * GET /api/parking-spaces
 * List parking spaces with optional filters.
 * Requires parking.read permission or BUILDING_MANAGER/ORG_ADMIN role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read parking spaces
    try {
      requirePermission(context, 'parking', 'read');
    } catch {
      // Fallback: Allow BUILDING_MANAGER, FACILITY_MANAGER, ORG_ADMIN to read parking spaces
      if (
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const spaceType = searchParams.get('spaceType') as ParkingSpaceType | null;
    const status = searchParams.get('status') as ParkingSpaceStatus | null;

    let parkingSpaces;

    // If buildingId is specified, use findParkingSpacesByBuilding
    if (buildingId) {
      const filters: Record<string, unknown> = {};
      if (spaceType) {
        filters.spaceType = spaceType;
      }
      if (status) {
        filters.status = status;
      }

      parkingSpaces = await findParkingSpacesByBuilding(
        buildingId,
        context.organizationId || undefined,
        filters,
      );
    }
    // Otherwise, list all parking spaces with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (spaceType) {
        baseQuery.spaceType = spaceType;
      }
      if (status) {
        baseQuery.status = status;
      }
      if (buildingId) {
        baseQuery.buildingId = buildingId;
      }

      parkingSpaces = await listParkingSpaces(baseQuery);
    }

    // Apply additional filters if provided (in case they were used with buildingId)
    if (spaceType) {
      parkingSpaces = parkingSpaces.filter((p) => p.spaceType === spaceType);
    }
    if (status) {
      parkingSpaces = parkingSpaces.filter((p) => p.status === status);
    }

    return NextResponse.json({
      parkingSpaces: parkingSpaces.map((p) => ({
        _id: p._id,
        organizationId: p.organizationId,
        buildingId: p.buildingId,
        spaceNumber: p.spaceNumber,
        spaceType: p.spaceType,
        status: p.status,
        assignedTo: p.assignedTo,
        vehicleId: p.vehicleId,
        notes: p.notes,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      count: parkingSpaces.length,
    });
  } catch (error) {
    console.error('Get parking spaces error', error);
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
      { error: 'Unexpected error while fetching parking spaces' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/parking-spaces
 * Create a new parking space.
 * Requires BUILDING_MANAGER or ORG_ADMIN role.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create parking spaces
    // BUILDING_MANAGER or ORG_ADMIN can create
    try {
      requirePermission(context, 'parking', 'create');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('BUILDING_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateParkingSpaceInput>;

    // Validate required fields
    if (!body.buildingId || !body.spaceNumber || !body.spaceType) {
      return NextResponse.json(
        {
          error: 'buildingId, spaceNumber, and spaceType are required',
        },
        { status: 400 },
      );
    }

    // Create parking space
    const input: CreateParkingSpaceInput = {
      organizationId,
      buildingId: body.buildingId,
      spaceNumber: body.spaceNumber,
      spaceType: body.spaceType,
      status: body.status ?? 'available',
      assignedTo: body.assignedTo ?? null,
      vehicleId: body.vehicleId ?? null,
      notes: body.notes ?? null,
    };

    try {
      const parkingSpace = await createParkingSpace(input);

      return NextResponse.json(
        {
          message: 'Parking space created successfully',
          parkingSpace: {
            _id: parkingSpace._id,
            organizationId: parkingSpace.organizationId,
            buildingId: parkingSpace.buildingId,
            spaceNumber: parkingSpace.spaceNumber,
            spaceType: parkingSpace.spaceType,
            status: parkingSpace.status,
            assignedTo: parkingSpace.assignedTo,
            vehicleId: parkingSpace.vehicleId,
            notes: parkingSpace.notes,
            createdAt: parkingSpace.createdAt,
            updatedAt: parkingSpace.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Tenant not found')) {
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
    console.error('Create parking space error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating parking space' },
      { status: 500 },
    );
  }
}
