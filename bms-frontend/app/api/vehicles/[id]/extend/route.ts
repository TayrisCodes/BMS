import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findVehicleById, updateVehicle } from '@/lib/parking/vehicles';

interface RouteParams {
  params: { id: string };
}

/**
 * PUT /api/vehicles/[id]/extend
 * Extends the expiration date of a temporary vehicle.
 * Requires parking.update permission.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'update');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    validateOrganizationAccess(context, context.organizationId);

    const vehicle = await findVehicleById(params.id, context.organizationId);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    if (!vehicle.isTemporary) {
      return NextResponse.json(
        { error: 'Only temporary vehicles can be extended' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { expiresAt } = body;

    if (!expiresAt) {
      return NextResponse.json({ error: 'expiresAt is required' }, { status: 400 });
    }

    const updatedVehicle = await updateVehicle(params.id, {
      expiresAt: new Date(expiresAt),
    });

    if (!updatedVehicle) {
      return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
    }

    return NextResponse.json({ vehicle: updatedVehicle });
  } catch (error) {
    console.error('Failed to extend temporary vehicle:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
