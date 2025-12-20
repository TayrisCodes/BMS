import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findParkingAssignmentById,
  updateParkingAssignment,
  deleteParkingAssignment,
  type ParkingAssignment,
} from '@/lib/parking/parking-assignments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/parking/assignments/[id]
 * Get a single parking assignment by ID.
 * Requires parking.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read parking
    try {
      requirePermission(context, 'parking', 'read');
    } catch {
      if (
        !context.roles.includes('SECURITY') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const assignment = await findParkingAssignmentById(id, context.organizationId || undefined);

    if (!assignment) {
      return NextResponse.json({ error: 'Parking assignment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, assignment.organizationId);

    return NextResponse.json({
      parkingAssignment: {
        _id: assignment._id,
        organizationId: assignment.organizationId,
        parkingSpaceId: assignment.parkingSpaceId,
        buildingId: assignment.buildingId,
        assignmentType: assignment.assignmentType,
        tenantId: assignment.tenantId,
        visitorLogId: assignment.visitorLogId,
        vehicleId: assignment.vehicleId,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        pricingId: assignment.pricingId,
        billingPeriod: assignment.billingPeriod,
        rate: assignment.rate,
        invoiceId: assignment.invoiceId,
        status: assignment.status,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get parking assignment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching parking assignment' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/parking/assignments/[id]
 * Update a parking assignment.
 * Requires parking.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update parking
    try {
      requirePermission(context, 'parking', 'update');
    } catch {
      if (
        !context.roles.includes('SECURITY') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing assignment to validate organization access
    const existingAssignment = await findParkingAssignmentById(
      id,
      context.organizationId || undefined,
    );

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Parking assignment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingAssignment.organizationId);

    const body = (await request.json()) as Partial<ParkingAssignment>;

    const updates: Partial<ParkingAssignment> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    try {
      const updatedAssignment = await updateParkingAssignment(id, updates);

      if (!updatedAssignment) {
        return NextResponse.json({ error: 'Failed to update parking assignment' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Parking assignment updated successfully',
        parkingAssignment: {
          _id: updatedAssignment._id,
          organizationId: updatedAssignment.organizationId,
          parkingSpaceId: updatedAssignment.parkingSpaceId,
          buildingId: updatedAssignment.buildingId,
          assignmentType: updatedAssignment.assignmentType,
          tenantId: updatedAssignment.tenantId,
          visitorLogId: updatedAssignment.visitorLogId,
          vehicleId: updatedAssignment.vehicleId,
          startDate: updatedAssignment.startDate,
          endDate: updatedAssignment.endDate,
          pricingId: updatedAssignment.pricingId,
          billingPeriod: updatedAssignment.billingPeriod,
          rate: updatedAssignment.rate,
          invoiceId: updatedAssignment.invoiceId,
          status: updatedAssignment.status,
          createdAt: updatedAssignment.createdAt,
          updatedAt: updatedAssignment.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update parking assignment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating parking assignment' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/parking/assignments/[id]
 * Delete (cancel) a parking assignment.
 * Requires parking.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete parking
    try {
      requirePermission(context, 'parking', 'delete');
    } catch {
      if (!context.roles.includes('ORG_ADMIN')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get existing assignment to validate organization access
    const existingAssignment = await findParkingAssignmentById(
      id,
      context.organizationId || undefined,
    );

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Parking assignment not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingAssignment.organizationId);

    try {
      const deleted = await deleteParkingAssignment(id, context.organizationId || undefined);

      if (!deleted) {
        return NextResponse.json({ error: 'Failed to delete parking assignment' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Parking assignment deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Delete parking assignment error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while deleting parking assignment' },
      { status: 500 },
    );
  }
}

