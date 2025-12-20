import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findVehicleById } from '@/lib/parking/vehicles';
import {
  createVehicleMovement,
  type CreateVehicleMovementInput,
} from '@/lib/parking/vehicle-movements';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/vehicles/[id]/log-movement
 * Log a vehicle movement (entry, exit, or reassignment).
 * Requires parking.update permission.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'update');
    validateOrganizationAccess(context);

    const vehicle = await findVehicleById(params.id, context.organizationId);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const input: CreateVehicleMovementInput = await request.json();

    const movement = await createVehicleMovement({
      ...input,
      organizationId: context.organizationId,
      vehicleId: params.id,
      loggedBy: context.userId,
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    console.error('Failed to log vehicle movement:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

