import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/auth/authz';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to read buildings
    requirePermission(context, 'buildings', 'read');

    const { id: buildingId } = await routeParams.params;

    // Verify building exists and user has access using domain model
    const building = await findBuildingById(buildingId, context.organizationId || undefined);

    if (!building) {
      return NextResponse.json({ error: 'Building not found' }, { status: 404 });
    }

    const db = await getDb();

    // Calculate occupancy stats using domain model
    const units = await findUnitsByBuilding(buildingId);
    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === 'occupied').length;

    const occupancyRate =
      totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100 * 100) / 100 : 0;

    // Calculate revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueData = await db
      .collection('payments')
      .aggregate([
        {
          $match: {
            buildingId: buildingId,
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const revenue = revenueData[0]?.total || 0;

    // Calculate outstanding receivables
    const outstandingData = await db
      .collection('invoices')
      .aggregate([
        {
          $match: {
            buildingId: buildingId,
            status: { $ne: 'paid' },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    const outstanding = outstandingData[0]?.total || 0;

    // Count complaints
    const complaints = await db.collection('complaints').countDocuments({
      buildingId: buildingId,
      status: { $ne: 'resolved' },
    });

    return NextResponse.json({
      stats: {
        occupancy: occupancyRate,
        revenue,
        outstanding,
        complaints,
        totalUnits,
        occupiedUnits,
      },
    });
  } catch (error) {
    console.error('Building stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch building stats' }, { status: 500 });
  }
}
