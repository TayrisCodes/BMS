import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getSubscriptionsCollection } from '@/lib/subscriptions/subscriptions';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can view subscription stats
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const collection = await getSubscriptionsCollection();

    // Get all subscriptions for stats
    const subscriptions = await collection.find({}).toArray();

    // Calculate MRR
    let mrr = 0;
    const activeSubs = subscriptions.filter(
      (sub) => (sub as any).status === 'active' || (sub as any).status === 'trial',
    );
    for (const sub of activeSubs) {
      if (sub.billingCycle === 'monthly') {
        mrr += sub.price || 0;
      } else if (sub.billingCycle === 'quarterly') {
        mrr += (sub.price || 0) / 3;
      } else if (sub.billingCycle === 'annually') {
        mrr += (sub.price || 0) / 12;
      }
    }

    // Count by status
    const statusCounts = {
      active: subscriptions.filter((s) => s.status === 'active').length,
      trial: subscriptions.filter((s) => s.status === 'trial').length,
      expired: subscriptions.filter((s) => s.status === 'expired').length,
      cancelled: subscriptions.filter((s) => s.status === 'cancelled').length,
      suspended: subscriptions.filter((s) => s.status === 'suspended').length,
    };

    // Count by tier
    const tierCounts = {
      starter: subscriptions.filter((s) => s.tier === 'starter').length,
      growth: subscriptions.filter((s) => s.tier === 'growth').length,
      enterprise: subscriptions.filter((s) => s.tier === 'enterprise').length,
    };

    // Count by billing cycle
    const billingCycleCounts = {
      monthly: subscriptions.filter((s) => s.billingCycle === 'monthly').length,
      quarterly: subscriptions.filter((s) => s.billingCycle === 'quarterly').length,
      annually: subscriptions.filter((s) => s.billingCycle === 'annually').length,
    };

    // Upcoming renewals (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingRenewals = subscriptions.filter((sub) => {
      if (!sub.nextBillingDate) return false;
      const nextBilling = new Date(sub.nextBillingDate);
      return nextBilling >= now && nextBilling <= thirtyDaysFromNow;
    }).length;

    // Expiring soon (next 30 days)
    const expiringSoon = subscriptions.filter((sub) => {
      if (!sub.endDate) return false;
      const endDate = new Date(sub.endDate);
      return endDate >= now && endDate <= thirtyDaysFromNow;
    }).length;

    return NextResponse.json({
      stats: {
        total: subscriptions.length,
        active: statusCounts.active,
        trial: statusCounts.trial,
        expired: statusCounts.expired,
        cancelled: statusCounts.cancelled,
        suspended: statusCounts.suspended,
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        tierDistribution: tierCounts,
        billingCycleDistribution: billingCycleCounts,
        upcomingRenewals,
        expiringSoon,
      },
    });
  } catch (error) {
    console.error('Subscription stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription stats' }, { status: 500 });
  }
}
