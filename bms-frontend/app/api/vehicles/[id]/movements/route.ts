import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findVehicleById } from '@/lib/parking/vehicles';
import { findVehicleMovementsByVehicle } from '@/lib/parking/vehicle-movements';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/vehicles/[id]/movements
 * Get vehicle movement log.
 * Requires parking.read permission.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'read');

    const vehicle = await findVehicleById(params.id, context.organizationId);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, vehicle.organizationId);

    const movements = await findVehicleMovementsByVehicle(params.id, context.organizationId);

    return NextResponse.json({ movements });
  } catch (error) {
    console.error('Failed to fetch vehicle movements:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicle movements' }, { status: 500 });
  }
}
