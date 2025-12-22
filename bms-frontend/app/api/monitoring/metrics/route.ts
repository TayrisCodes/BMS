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

    // Only SUPER_ADMIN can access metrics
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get active users (users who logged in within last hour)
    const activeUsers = await db.collection('users').countDocuments({
      lastLoginAt: { $gte: oneHourAgo },
    });

    // Calculate API request rate (this is a placeholder - in production, you'd track this in real-time)
    // For now, we'll estimate based on recent activity logs
    const recentActivityCount = await db.collection('userActivityLogs').countDocuments({
      createdAt: { $gte: oneHourAgo },
    });
    const apiRequestRate = Math.round(recentActivityCount / 60); // requests per minute

    // Calculate error rate (placeholder - would need error tracking)
    // For now, check for failed payment attempts or other error indicators
    const totalPayments = await db.collection('payments').countDocuments({
      createdAt: { $gte: oneHourAgo },
    });
    const failedPayments = await db.collection('payments').countDocuments({
      createdAt: { $gte: oneHourAgo },
      status: 'failed',
    });
    const errorRate = totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0;

    // Average response time (placeholder - would need actual API monitoring)
    // For now, use database query time as a proxy
    const startTime = Date.now();
    await db.collection('organizations').findOne({});
    const dbResponseTime = Date.now() - startTime;
    const averageResponseTime = dbResponseTime; // In production, this would be averaged from actual API calls

    return NextResponse.json({
      metrics: {
        activeUsers,
        apiRequestRate,
        errorRate: Math.round(errorRate * 100) / 100,
        averageResponseTime,
      },
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
