import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getBuildingsCollection,
  createBuilding,
  listBuildings,
  type CreateBuildingInput,
} from '@/lib/buildings/buildings';

/**
 * GET /api/buildings
 * List buildings with optional filters.
 * Requires buildings.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read buildings
    requirePermission(context, 'buildings', 'read');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const buildingType = searchParams.get('buildingType');
    const search = searchParams.get('search'); // For name search

    // Build query with organization scope
    const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

    // Add filters
    if (status) {
      baseQuery.status = status;
    }

    if (buildingType) {
      baseQuery.buildingType = buildingType;
    }

    // Search by name
    if (search) {
      baseQuery.name = { $regex: search.trim(), $options: 'i' };
    }

    const buildings = await listBuildings(baseQuery);

    return NextResponse.json({
      buildings: buildings.map((b) => ({
        _id: b._id,
        name: b.name,
        address: b.address,
        buildingType: b.buildingType,
        totalFloors: b.totalFloors,
        totalUnits: b.totalUnits,
        status: b.status,
        managerId: b.managerId,
        settings: b.settings,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      count: buildings.length,
    });
  } catch (error) {
    console.error('Get buildings error', error);
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
      { error: 'Unexpected error while fetching buildings' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/buildings
 * Create a new building.
 * Requires buildings.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create buildings
    requirePermission(context, 'buildings', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateBuildingInput>;

    // Validate required fields
    if (!body.name || !body.buildingType) {
      return NextResponse.json({ error: 'name and buildingType are required' }, { status: 400 });
    }

    // Create building
    const input: CreateBuildingInput = {
      organizationId,
      name: body.name,
      address: body.address ?? null,
      buildingType: body.buildingType,
      totalFloors: body.totalFloors ?? null,
      totalUnits: body.totalUnits ?? null,
      status: body.status ?? 'active',
      managerId: body.managerId ?? null,
      settings: body.settings ?? null,
    };

    const building = await createBuilding(input);

    return NextResponse.json(
      {
        message: 'Building created successfully',
        building: {
          _id: building._id,
          name: building.name,
          address: building.address,
          buildingType: building.buildingType,
          totalFloors: building.totalFloors,
          totalUnits: building.totalUnits,
          status: building.status,
          managerId: building.managerId,
          settings: building.settings,
          createdAt: building.createdAt,
          updatedAt: building.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create building error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating building' },
      { status: 500 },
    );
  }
}
