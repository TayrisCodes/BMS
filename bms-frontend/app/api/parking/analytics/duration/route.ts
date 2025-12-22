import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  getDurationStatistics,
  getPeakParkingHours,
  getDurationTrends,
} from '@/modules/parking/duration-analytics';

/**
 * GET /api/parking/analytics/duration
 * Get parking duration statistics and trends.
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodType = (searchParams.get('periodType') || 'monthly') as
      | 'daily'
      | 'monthly'
      | 'quarterly';
    const numPeriods = parseInt(searchParams.get('numPeriods') || '12', 10);

    const statistics = await getDurationStatistics(
      context.organizationId,
      buildingId || undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    const peakHours = await getPeakParkingHours(
      context.organizationId,
      buildingId || undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    const trends = await getDurationTrends(
      context.organizationId,
      buildingId || undefined,
      periodType,
      numPeriods,
    );

    return NextResponse.json({
      statistics,
      peakHours,
      trends,
    });
  } catch (error) {
    console.error('Failed to fetch duration analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch duration analytics' }, { status: 500 });
  }
}
