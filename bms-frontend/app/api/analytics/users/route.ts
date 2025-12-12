import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can view user analytics
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // User growth over time (last 12 months)
    const userGrowth = await db
      .collection('users')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: oneYearAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ])
      .toArray();

    // User role distribution
    const roleDistribution = await db
      .collection('users')
      .aggregate([
        {
          $unwind: '$roles',
        },
        {
          $group: {
            _id: '$roles',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Users by organization
    const usersByOrg = await db
      .collection('users')
      .aggregate([
        {
          $group: {
            _id: '$organizationId',
            count: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            invited: {
              $sum: { $cond: [{ $eq: ['$status', 'invited'] }, 1, 0] },
            },
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
            active: 1,
            invited: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // User status distribution
    const statusDistribution = await db
      .collection('users')
      .aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Format growth data for chart
    const formattedGrowth = userGrowth.map((item) => {
      const date = new Date(item._id.year, item._id.month - 1, 1);
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: item.count,
      };
    });

    return NextResponse.json({
      growth: formattedGrowth,
      roleDistribution: roleDistribution.map((item) => ({
        role: item._id,
        count: item.count,
      })),
      byOrganization: usersByOrg,
      statusDistribution: statusDistribution.map((item) => ({
        status: item._id,
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('User analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch user analytics' }, { status: 500 });
  }
}
