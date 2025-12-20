import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findVehicleById } from '@/lib/parking/vehicles';
import { findVehicleMovementsByVehicle } from '@/lib/parking/vehicle-movements';
import { listParkingLogs } from '@/lib/parking/parking-logs';
import { listParkingAssignments } from '@/lib/parking/parking-assignments';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/vehicles/[id]/history
 * Get comprehensive vehicle history including movements, logs, and assignments.
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

    const vehicle = await findVehicleById(params.id, context.organizationId);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Get movements
    const movements = await findVehicleMovementsByVehicle(params.id, context.organizationId);

    // Get parking logs
    const logs = await listParkingLogs(context.organizationId, { vehicleId: params.id });

    // Get assignments
    const assignments = await listParkingAssignments({
      organizationId: context.organizationId,
      vehicleId: params.id,
    });

    return NextResponse.json({
      vehicle,
      movements,
      logs,
      assignments,
    });
  } catch (error) {
    console.error('Failed to fetch vehicle history:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicle history' }, { status: 500 });
  }
}

