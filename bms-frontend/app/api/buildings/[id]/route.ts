import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findBuildingById,
  updateBuilding,
  deleteBuilding,
  type Building,
} from '@/lib/buildings/buildings';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/buildings/[id]
 * Get a single building by ID.
 * Requires buildings.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read buildings
    requirePermission(context, 'buildings', 'read');

    const building = await findBuildingById(id, context.organizationId || undefined);

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, building.organizationId);

    return NextResponse.json({
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
        organizationId: building.organizationId,
        createdAt: building.createdAt,
        updatedAt: building.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get building error', error);
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
      { error: 'Unexpected error while fetching building' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/buildings/[id]
 * Update a building.
 * Requires buildings.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update buildings
    requirePermission(context, 'buildings', 'update');

    // Get existing building to validate organization access
    const existingBuilding = await findBuildingById(id, context.organizationId || undefined);

    if (!existingBuilding) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingBuilding.organizationId);

    const body = (await request.json()) as Partial<Building>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Building> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    const updatedBuilding = await updateBuilding(id, updates);

    if (!updatedBuilding) {
      return NextResponse.json({ error: 'Failed to update building' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Building updated successfully',
      building: {
        _id: updatedBuilding._id,
        name: updatedBuilding.name,
        address: updatedBuilding.address,
        buildingType: updatedBuilding.buildingType,
        totalFloors: updatedBuilding.totalFloors,
        totalUnits: updatedBuilding.totalUnits,
        status: updatedBuilding.status,
        managerId: updatedBuilding.managerId,
        settings: updatedBuilding.settings,
        organizationId: updatedBuilding.organizationId,
        createdAt: updatedBuilding.createdAt,
        updatedAt: updatedBuilding.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update building error', error);
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
      { error: 'Unexpected error while updating building' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/buildings/[id]
 * Soft delete a building (sets status to inactive).
 * Requires buildings.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete buildings
    requirePermission(context, 'buildings', 'delete');

    // Get existing building to validate organization access
    const existingBuilding = await findBuildingById(id, context.organizationId || undefined);

    if (!existingBuilding) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingBuilding.organizationId);

    // TODO: Check if building has active leases before deleting
    // For now, just soft delete

    const deleted = await deleteBuilding(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete building' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Building deleted successfully (soft delete - status set to inactive)',
    });
  } catch (error) {
    console.error('Delete building error', error);
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
      { error: 'Unexpected error while deleting building' },
      { status: 500 },
    );
  }
}
