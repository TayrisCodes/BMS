import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can view building analytics
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();

    // Buildings by organization
    const buildingsByOrg = await db
      .collection('buildings')
      .aggregate([
        {
          $group: {
            _id: '$organizationId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'organizations',
            let: { orgId: { $toString: '$_id' } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: '$_id' }, '$$orgId'],
                  },
                },
              },
            ],
            as: 'organization',
          },
        },
        {
          $unwind: {
            path: '$organization',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            organizationId: '$_id',
            organizationName: '$organization.name',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Units by organization
    const unitsByOrg = await db
      .collection('units')
      .aggregate([
        {
          $group: {
            _id: '$organizationId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'organizations',
            let: { orgId: { $toString: '$_id' } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: '$_id' }, '$$orgId'],
                  },
                },
              },
            ],
            as: 'organization',
          },
        },
        {
          $unwind: {
            path: '$organization',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            organizationId: '$_id',
            organizationName: '$organization.name',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Occupancy calculation (units with active leases)
    const totalUnits = await db.collection('units').countDocuments({});
    const unitsWithActiveLeases = await db
      .collection('leases')
      .distinct('unitId', { status: 'active' });

    const occupancyRate = totalUnits > 0 ? (unitsWithActiveLeases.length / totalUnits) * 100 : 0;

    // Building type distribution (if type field exists)
    const buildingTypeDistribution = await db
      .collection('buildings')
      .aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    return NextResponse.json({
      buildingsByOrganization: buildingsByOrg,
      unitsByOrganization: unitsByOrg,
      occupancy: {
        totalUnits,
        occupiedUnits: unitsWithActiveLeases.length,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
      },
      buildingTypeDistribution: buildingTypeDistribution.map((item) => ({
        type: item._id || 'Unknown',
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('Building analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch building analytics' }, { status: 500 });
  }
}
