import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { calculateParkingAvailability } from '@/modules/parking/availability';

/**
 * GET /api/parking/availability
 * Get real-time parking availability for a building.
 * Requires parking.read permission.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'read');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    validateOrganizationAccess(context, context.organizationId);

    const { searchParams } = request.nextUrl;
    const buildingId = searchParams.get('buildingId');

    if (!buildingId) {
      return NextResponse.json({ error: 'buildingId is required' }, { status: 400 });
    }

    const availability = await calculateParkingAvailability(buildingId, context.organizationId);

    return NextResponse.json({ availability });
  } catch (error) {
    console.error('Failed to calculate parking availability:', error);
    return NextResponse.json(
      { error: 'Failed to calculate parking availability' },
      { status: 500 },
    );
  }
}
