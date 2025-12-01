import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findParkingSpaceById,
  updateParkingSpace,
  deleteParkingSpace,
  type ParkingSpace,
} from '@/lib/parking/parking-spaces';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/parking-spaces/[id]
 * Get a single parking space by ID.
 * Requires parking.read permission or BUILDING_MANAGER/ORG_ADMIN role.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

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

    const parkingSpace = await findParkingSpaceById(id, context.organizationId || undefined);

    if (!parkingSpace) {
      return NextResponse.json({ error: 'Parking space not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, parkingSpace.organizationId);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Get parking space error', error);
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
      { error: 'Unexpected error while fetching parking space' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/parking-spaces/[id]
 * Update a parking space.
 * Requires parking.update permission or BUILDING_MANAGER/ORG_ADMIN role.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update parking spaces
    try {
      requirePermission(context, 'parking', 'update');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('BUILDING_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing parking space to validate organization access
    const existingSpace = await findParkingSpaceById(id, context.organizationId || undefined);

    if (!existingSpace) {
      return NextResponse.json({ error: 'Parking space not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingSpace.organizationId);

    const body = (await request.json()) as Partial<ParkingSpace>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<ParkingSpace> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    try {
      const updatedSpace = await updateParkingSpace(id, updates);

      if (!updatedSpace) {
        return NextResponse.json({ error: 'Failed to update parking space' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Parking space updated successfully',
        parkingSpace: {
          _id: updatedSpace._id,
          organizationId: updatedSpace.organizationId,
          buildingId: updatedSpace.buildingId,
          spaceNumber: updatedSpace.spaceNumber,
          spaceType: updatedSpace.spaceType,
          status: updatedSpace.status,
          assignedTo: updatedSpace.assignedTo,
          vehicleId: updatedSpace.vehicleId,
          notes: updatedSpace.notes,
          createdAt: updatedSpace.createdAt,
          updatedAt: updatedSpace.updatedAt,
        },
      });
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
      }
      throw error;
    }
  } catch (error) {
    console.error('Update parking space error', error);
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
      { error: 'Unexpected error while updating parking space' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/parking-spaces/[id]
 * Delete a parking space.
 * Requires parking.delete permission or BUILDING_MANAGER/ORG_ADMIN role.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete parking spaces
    try {
      requirePermission(context, 'parking', 'delete');
    } catch {
      // Check if user has appropriate role
      if (!context.roles.includes('BUILDING_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing parking space to validate organization access
    const existingSpace = await findParkingSpaceById(id, context.organizationId || undefined);

    if (!existingSpace) {
      return NextResponse.json({ error: 'Parking space not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingSpace.organizationId);

    const deleted = await deleteParkingSpace(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete parking space' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Parking space deleted successfully',
    });
  } catch (error) {
    console.error('Delete parking space error', error);
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
      { error: 'Unexpected error while deleting parking space' },
      { status: 500 },
    );
  }
}
