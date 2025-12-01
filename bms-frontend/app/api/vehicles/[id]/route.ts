import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findVehicleById,
  updateVehicle,
  deleteVehicle,
  type Vehicle,
} from '@/lib/parking/vehicles';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vehicles/[id]
 * Get a single vehicle by ID.
 * Requires vehicles.read permission or appropriate role.
 * Tenants can only see their own vehicles.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const vehicle = await findVehicleById(id, context.organizationId || undefined);

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, vehicle.organizationId);

    // If user is a tenant, they can only see their own vehicles
    if (context.roles.includes('TENANT') && context.tenantId) {
      if (vehicle.tenantId !== context.tenantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
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
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Get vehicle error', error);
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
    return NextResponse.json({ error: 'Unexpected error while fetching vehicle' }, { status: 500 });
  }
}

/**
 * PATCH /api/vehicles/[id]
 * Update a vehicle.
 * Requires vehicles.update permission or appropriate role.
 * Tenants can only update their own vehicles.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get existing vehicle to validate organization access
    const existingVehicle = await findVehicleById(id, context.organizationId || undefined);

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingVehicle.organizationId);

    // If user is a tenant, they can only update their own vehicles
    if (context.roles.includes('TENANT') && context.tenantId) {
      if (existingVehicle.tenantId !== context.tenantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      // For staff users, require permission to update vehicles
      try {
        requirePermission(context, 'parking', 'update');
      } catch {
        // Check if user has appropriate role
        if (!context.roles.includes('BUILDING_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    const body = (await request.json()) as Partial<Vehicle>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Vehicle> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // Tenants cannot change tenantId
    if (context.roles.includes('TENANT') && updates.tenantId !== undefined) {
      delete updates.tenantId;
    }

    try {
      const updatedVehicle = await updateVehicle(id, updates);

      if (!updatedVehicle) {
        return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Vehicle updated successfully',
        vehicle: {
          _id: updatedVehicle._id,
          organizationId: updatedVehicle.organizationId,
          tenantId: updatedVehicle.tenantId,
          plateNumber: updatedVehicle.plateNumber,
          make: updatedVehicle.make,
          model: updatedVehicle.model,
          color: updatedVehicle.color,
          parkingSpaceId: updatedVehicle.parkingSpaceId,
          status: updatedVehicle.status,
          notes: updatedVehicle.notes,
          createdAt: updatedVehicle.createdAt,
          updatedAt: updatedVehicle.updatedAt,
        },
      });
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
      }
      throw error;
    }
  } catch (error) {
    console.error('Update vehicle error', error);
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
    return NextResponse.json({ error: 'Unexpected error while updating vehicle' }, { status: 500 });
  }
}

/**
 * DELETE /api/vehicles/[id]
 * Soft delete a vehicle (sets status to inactive).
 * Requires vehicles.delete permission or appropriate role.
 * Tenants can only delete their own vehicles.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get existing vehicle to validate organization access
    const existingVehicle = await findVehicleById(id, context.organizationId || undefined);

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingVehicle.organizationId);

    // If user is a tenant, they can only delete their own vehicles
    if (context.roles.includes('TENANT') && context.tenantId) {
      if (existingVehicle.tenantId !== context.tenantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      // For staff users, require permission to delete vehicles
      try {
        requirePermission(context, 'parking', 'delete');
      } catch {
        // Check if user has appropriate role
        if (!context.roles.includes('BUILDING_MANAGER') && !context.roles.includes('ORG_ADMIN')) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    const deleted = await deleteVehicle(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete vehicle' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Vehicle deleted successfully (soft delete - status set to inactive)',
    });
  } catch (error) {
    console.error('Delete vehicle error', error);
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
    return NextResponse.json({ error: 'Unexpected error while deleting vehicle' }, { status: 500 });
  }
}
