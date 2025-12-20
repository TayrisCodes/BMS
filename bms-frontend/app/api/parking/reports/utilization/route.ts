import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  getUtilizationStatistics,
  getUtilizationTrends,
} from '@/modules/parking/utilization-analytics';

/**
 * GET /api/parking/reports/utilization
 * Generate parking utilization report.
 * Requires parking.read permission.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'read');
    validateOrganizationAccess(context);

    const { searchParams } = request.nextUrl;
    const buildingId = searchParams.get('buildingId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodType = (searchParams.get('periodType') || 'monthly') as
      | 'daily'
      | 'monthly'
      | 'quarterly';
    const numPeriods = parseInt(searchParams.get('numPeriods') || '12', 10);

    if (!buildingId) {
      return NextResponse.json({ error: 'buildingId is required' }, { status: 400 });
    }

    const statistics = await getUtilizationStatistics(
      context.organizationId,
      buildingId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    const trends = await getUtilizationTrends(
      context.organizationId,
      buildingId,
      periodType,
      numPeriods,
    );

    return NextResponse.json({
      statistics,
      trends,
    });
  } catch (error) {
    console.error('Failed to generate utilization report:', error);
    return NextResponse.json({ error: 'Failed to generate utilization report' }, { status: 500 });
  }
}

