import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findParkingViolationById,
  updateParkingViolation,
  deleteParkingViolation,
} from '@/lib/parking/parking-violations';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/parking/violations/[id]
 * Fetches a single parking violation.
 * Requires parking.read permission.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'read');
    validateOrganizationAccess(context);

    const violation = await findParkingViolationById(params.id, context.organizationId);

    if (!violation) {
      return NextResponse.json({ error: 'Parking violation not found' }, { status: 404 });
    }

    return NextResponse.json({ violation });
  } catch (error) {
    console.error('Failed to fetch parking violation:', error);
    return NextResponse.json({ error: 'Failed to fetch parking violation' }, { status: 500 });
  }
}

/**
 * PUT /api/parking/violations/[id]
 * Updates a parking violation.
 * Requires parking.update permission.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'update');
    validateOrganizationAccess(context);

    const updates = await request.json();

    // If resolving, set resolvedBy to current user
    if (updates.status === 'resolved' && !updates.resolvedBy) {
      updates.resolvedBy = context.userId;
    }

    const updatedViolation = await updateParkingViolation(
      params.id,
      context.organizationId,
      updates,
    );

    if (!updatedViolation) {
      return NextResponse.json({ error: 'Parking violation not found' }, { status: 404 });
    }

    return NextResponse.json({ violation: updatedViolation });
  } catch (error) {
    console.error('Failed to update parking violation:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/parking/violations/[id]
 * Deletes a parking violation.
 * Requires parking.delete permission.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'delete');
    validateOrganizationAccess(context);

    const deleted = await deleteParkingViolation(params.id, context.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Parking violation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Parking violation deleted successfully' });
  } catch (error) {
    console.error('Failed to delete parking violation:', error);
    return NextResponse.json({ error: 'Failed to delete parking violation' }, { status: 500 });
  }
}

