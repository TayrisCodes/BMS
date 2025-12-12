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

    // Only SUPER_ADMIN can view revenue analytics
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y, all
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month

    const db = await getDb();
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Revenue by organization
    const revenueByOrg = await db
      .collection('subscriptions')
      .aggregate([
        {
          $match: {
            status: { $in: ['active', 'trial'] },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$organizationId',
            totalRevenue: { $sum: '$price' },
            subscriptionCount: { $sum: 1 },
            avgPrice: { $avg: '$price' },
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
            totalRevenue: 1,
            subscriptionCount: 1,
            avgPrice: 1,
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Revenue by tier
    const revenueByTier = await db
      .collection('subscriptions')
      .aggregate([
        {
          $match: {
            status: { $in: ['active', 'trial'] },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$tier',
            totalRevenue: { $sum: '$price' },
            subscriptionCount: { $sum: 1 },
            avgPrice: { $avg: '$price' },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ])
      .toArray();

    // Revenue trends over time
    let dateGroupFormat: Record<string, unknown>;
    if (groupBy === 'day') {
      dateGroupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
    } else if (groupBy === 'week') {
      dateGroupFormat = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' },
      };
    } else {
      dateGroupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    }

    const revenueTrends = await db
      .collection('subscriptions')
      .aggregate([
        {
          $match: {
            status: { $in: ['active', 'trial'] },
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: dateGroupFormat,
            totalRevenue: { $sum: '$price' },
            subscriptionCount: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
      ])
      .toArray();

    // Format trends for chart
    const formattedTrends = revenueTrends.map((item) => {
      const date = new Date(item._id.year, (item._id.month || 1) - 1, item._id.day || 1);
      let label: string;
      if (groupBy === 'day') {
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (groupBy === 'week') {
        label = `Week ${item._id.week}, ${item._id.year}`;
      } else {
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      return {
        date: label,
        revenue: item.totalRevenue,
        count: item.subscriptionCount,
      };
    });

    return NextResponse.json({
      byOrganization: revenueByOrg,
      byTier: revenueByTier,
      trends: formattedTrends,
      period,
      groupBy,
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue analytics' }, { status: 500 });
  }
}
