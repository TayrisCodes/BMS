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

    // Only SUPER_ADMIN can view platform analytics
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get total counts
    const [
      totalOrganizations,
      totalUsers,
      totalBuildings,
      totalUnits,
      totalTenants,
      totalSubscriptions,
      activeSubscriptions,
    ] = await Promise.all([
      db.collection('organizations').countDocuments({}),
      db.collection('users').countDocuments({}),
      db.collection('buildings').countDocuments({}),
      db.collection('units').countDocuments({}),
      db.collection('tenants').countDocuments({}),
      db.collection('subscriptions').countDocuments({}),
      db.collection('subscriptions').countDocuments({
        status: { $in: ['active', 'trial'] },
      }),
    ]);

    // Get growth metrics (last 30 days)
    const [newOrganizations, newUsers, newBuildings, newSubscriptions] = await Promise.all([
      db.collection('organizations').countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      }),
      db.collection('users').countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      }),
      db.collection('buildings').countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      }),
      db.collection('subscriptions').countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      }),
    ]);

    // Calculate MRR from active subscriptions
    const subscriptions = await db
      .collection('subscriptions')
      .find({ status: { $in: ['active', 'trial'] } })
      .toArray();

    let mrr = 0;
    for (const sub of subscriptions) {
      if (sub.billingCycle === 'monthly') {
        mrr += sub.price || 0;
      } else if (sub.billingCycle === 'quarterly') {
        mrr += (sub.price || 0) / 3;
      } else if (sub.billingCycle === 'annually') {
        mrr += (sub.price || 0) / 12;
      }
    }

    // Get organization distribution by status
    const orgStatusDistribution = await db
      .collection('organizations')
      .aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get subscription tier distribution
    const tierDistribution = await db
      .collection('subscriptions')
      .aggregate([
        {
          $group: {
            _id: '$tier',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$price' },
          },
        },
      ])
      .toArray();

    return NextResponse.json({
      overview: {
        totalOrganizations,
        totalUsers,
        totalBuildings,
        totalUnits,
        totalTenants,
        totalSubscriptions,
        activeSubscriptions,
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
      },
      growth: {
        last30Days: {
          newOrganizations,
          newUsers,
          newBuildings,
          newSubscriptions,
        },
      },
      distributions: {
        organizationStatus: orgStatusDistribution.map((item) => ({
          status: item._id || 'active',
          count: item.count,
        })),
        subscriptionTiers: tierDistribution.map((item) => ({
          tier: item._id,
          count: item.count,
          totalRevenue: item.totalRevenue,
        })),
      },
    });
  } catch (error) {
    console.error('Platform analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch platform analytics' }, { status: 500 });
  }
}





