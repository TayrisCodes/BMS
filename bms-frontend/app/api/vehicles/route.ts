import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getVehiclesCollection,
  createVehicle,
  listVehicles,
  findVehiclesByTenant,
  findVehiclesByParkingSpace,
  type CreateVehicleInput,
  type VehicleStatus,
} from '@/lib/parking/vehicles';

/**
 * GET /api/vehicles
 * List vehicles with optional filters.
 * Requires vehicles.read permission or appropriate role.
 * Tenants can only see their own vehicles.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const parkingSpaceId = searchParams.get('parkingSpaceId');
    const status = searchParams.get('status') as VehicleStatus | null;

    // If user is a tenant, they can only see their own vehicles
    if (context.roles.includes('TENANT') && context.tenantId) {
      const tenantVehicles = await findVehiclesByTenant(
        context.tenantId,
        context.organizationId || undefined,
        status ? { status } : {},
      );

      return NextResponse.json({
        vehicles: tenantVehicles.map((v) => ({
          _id: v._id,
          organizationId: v.organizationId,
          tenantId: v.tenantId,
          plateNumber: v.plateNumber,
          make: v.make,
          model: v.model,
          color: v.color,
          parkingSpaceId: v.parkingSpaceId,
          status: v.status,
          notes: v.notes,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        })),
        count: tenantVehicles.length,
      });
    }

    // For staff users, require permission to read vehicles
    try {
      requirePermission(context, 'parking', 'read');
    } catch {
      // Fallback: Allow BUILDING_MANAGER, FACILITY_MANAGER, ORG_ADMIN to read vehicles
      if (
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    let vehicles;

    // If tenantId is specified, use findVehiclesByTenant
    if (tenantId) {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }

      vehicles = await findVehiclesByTenant(tenantId, context.organizationId || undefined, filters);
    }
    // If parkingSpaceId is specified, use findVehiclesByParkingSpace
    else if (parkingSpaceId) {
      vehicles = await findVehiclesByParkingSpace(
        parkingSpaceId,
        context.organizationId || undefined,
      );
    }
    // Otherwise, list all vehicles with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (status) {
        baseQuery.status = status;
      }
      if (tenantId) {
        baseQuery.tenantId = tenantId;
      }
      if (parkingSpaceId) {
        baseQuery.parkingSpaceId = parkingSpaceId;
      }

      vehicles = await listVehicles(baseQuery);
    }

    // Apply additional filters if provided
    if (status) {
      vehicles = vehicles.filter((v) => v.status === status);
    }

    return NextResponse.json({
      vehicles: vehicles.map((v) => ({
        _id: v._id,
        organizationId: v.organizationId,
        tenantId: v.tenantId,
        plateNumber: v.plateNumber,
        make: v.make,
        model: v.model,
        color: v.color,
        parkingSpaceId: v.parkingSpaceId,
        status: v.status,
        notes: v.notes,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      count: vehicles.length,
    });
  } catch (error) {
    console.error('Get vehicles error', error);
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
      { error: 'Unexpected error while fetching vehicles' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/vehicles
 * Create a new vehicle.
 * Tenants can create their own vehicles, staff can create for tenants.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateVehicleInput>;

    // Validate required fields
    if (!body.plateNumber) {
      return NextResponse.json(
        {
          error: 'plateNumber is required',
        },
        { status: 400 },
      );
    }

    // Determine tenantId: use from body if provided (staff), or use context.tenantId (tenant creating own)
    let tenantId: string;
    if (body.tenantId) {
      // Staff creating vehicle for a tenant - require permission
      try {
        requirePermission(context, 'parking', 'create');
      } catch {
        // Check if user has appropriate role
        if (
          !context.roles.includes('BUILDING_MANAGER') &&
          !context.roles.includes('FACILITY_MANAGER') &&
          !context.roles.includes('ORG_ADMIN')
        ) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
      tenantId = body.tenantId;
    } else if (context.tenantId) {
      // Tenant creating their own vehicle
      tenantId = context.tenantId;
    } else {
      return NextResponse.json(
        {
          error: 'tenantId is required (or you must be a tenant creating your own vehicle)',
        },
        { status: 400 },
      );
    }

    // Create vehicle
    const input: CreateVehicleInput = {
      organizationId,
      tenantId,
      plateNumber: body.plateNumber,
      make: body.make ?? null,
      model: body.model ?? null,
      color: body.color ?? null,
      parkingSpaceId: body.parkingSpaceId ?? null,
      status: body.status ?? 'active',
      notes: body.notes ?? null,
    };

    try {
      const vehicle = await createVehicle(input);

      return NextResponse.json(
        {
          message: 'Vehicle created successfully',
          vehicle: {
            _id: vehicle._id,
            organizationId: vehicle.organizationId,
            tenantId: vehicle.tenantId,
            plateNumber: vehicle.plateNumber,
            make: vehicle.make,
            model: vehicle.model,
            color: vehicle.color,
            parkingSpaceId: vehicle.parkingSpaceId,
            status: vehicle.status,
            notes: vehicle.notes,
            createdAt: vehicle.createdAt,
            updatedAt: vehicle.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Tenant not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Parking space not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('already exists')) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message.includes('is required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create vehicle error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating vehicle' }, { status: 500 });
  }
}
