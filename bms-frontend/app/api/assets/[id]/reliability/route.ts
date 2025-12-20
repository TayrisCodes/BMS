import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  calculateAssetReliability,
  getAssetReliabilityScore,
} from '@/modules/assets/reliability-metrics';
import { findAssetById } from '@/lib/assets/assets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assets/[id]/reliability
 * Get reliability metrics for an asset.
 * Requires assets.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read assets
    requirePermission(context, 'assets', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Validate asset exists and belongs to organization
    const asset = await findAssetById(id, organizationId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, asset.organizationId);

    const { searchParams } = new URL(request.url);
    const periodMonthsParam = searchParams.get('periodMonths');
    const periodMonths = periodMonthsParam ? parseInt(periodMonthsParam, 10) : 12;

    if (isNaN(periodMonths) || periodMonths <= 0) {
      return NextResponse.json({ error: 'Invalid periodMonths parameter' }, { status: 400 });
    }

    try {
      const metrics = await calculateAssetReliability(id, organizationId, periodMonths);
      const reliabilityScore = await getAssetReliabilityScore(id, organizationId, periodMonths);

      return NextResponse.json({
        metrics: {
          assetId: metrics.assetId,
          periodMonths: metrics.periodMonths,
          maintenanceFrequency: metrics.maintenanceFrequency,
          averageDaysBetweenMaintenance: metrics.averageDaysBetweenMaintenance,
          totalDowntimeHours: metrics.totalDowntimeHours,
          averageDowntimeHours: metrics.averageDowntimeHours,
          totalMaintenanceCost: metrics.totalMaintenanceCost,
          averageCostPerMaintenance: metrics.averageCostPerMaintenance,
          lastMaintenanceDate: metrics.lastMaintenanceDate?.toISOString() || null,
          daysSinceLastMaintenance: metrics.daysSinceLastMaintenance,
          nextMaintenanceDue: metrics.nextMaintenanceDue?.toISOString() || null,
          daysUntilNextMaintenance: metrics.daysUntilNextMaintenance,
          totalPartsCost: metrics.totalPartsCost,
          preventiveCount: metrics.preventiveCount,
          correctiveCount: metrics.correctiveCount,
          emergencyCount: metrics.emergencyCount,
        },
        reliabilityScore,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Get asset reliability error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching asset reliability' },
      { status: 500 },
    );
  }
}

