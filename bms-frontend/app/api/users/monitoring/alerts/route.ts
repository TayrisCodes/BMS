import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getUserActivityLogsCollection } from '@/lib/users/user-activity-logs';
import { getUsersCollection } from '@/lib/auth/users';
import { withOptionalOrganizationScope } from '@/lib/organizations/scoping';
import { getDb } from '@/lib/db';

/**
 * GET /api/users/monitoring/alerts
 * Get security alerts (multiple failed logins, suspicious activity).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSuperAdmin(context) && !context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    const db = await getDb();
    const activityCollection = await getUserActivityLogsCollection();
    const usersCollection = await getUsersCollection();

    // Build query for organization scoping
    let orgQuery: Record<string, unknown> = {};
    if (!isSuperAdmin(context)) {
      orgQuery = withOptionalOrganizationScope(context, {});
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const alerts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      message: string;
      userId?: string;
      userName?: string;
      count?: number;
      details?: Record<string, unknown>;
    }> = [];

    // Check for multiple failed login attempts (permission_denied)
    const failedLogins = await activityCollection
      .aggregate([
        {
          $match: {
            ...orgQuery,
            action: 'permission_denied',
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            lastAttempt: { $max: '$createdAt' },
            ipAddresses: { $addToSet: '$ipAddress' },
          },
        },
        {
          $match: {
            count: { $gte: 5 }, // 5 or more failed attempts
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Get user details for failed login alerts
    const failedLoginUserIds = failedLogins.map((f) => f._id).filter(Boolean);
    if (failedLoginUserIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      const users = await usersCollection
        .find({
          _id: { $in: failedLoginUserIds.map((id) => new ObjectId(id as string)) },
        })
        .toArray();

      const userMap = new Map<string, any>();
      users.forEach((user: any) => {
        userMap.set(user._id.toString(), {
          name: user.name,
          email: user.email,
          phone: user.phone,
        });
      });

      failedLogins.forEach((login) => {
        const user = userMap.get(login._id as string);
        alerts.push({
          type: 'multiple_failed_logins',
          severity: login.count >= 10 ? 'high' : 'medium',
          message: `User has ${login.count} failed login attempts in the last ${days} days`,
          userId: login._id as string,
          userName: user?.name || user?.email || 'Unknown',
          count: login.count,
          details: {
            lastAttempt: login.lastAttempt,
            ipAddresses: login.ipAddresses.filter(Boolean),
          },
        });
      });
    }

    // Check for users with no activity in last 30 days but status is active
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveActiveUsers = await usersCollection
      .find({
        ...orgQuery,
        status: 'active',
        $or: [{ lastLoginAt: { $lt: thirtyDaysAgo } }, { lastLoginAt: null }],
      })
      .limit(10)
      .toArray();

    if (inactiveActiveUsers.length > 0) {
      alerts.push({
        type: 'inactive_active_users',
        severity: 'low',
        message: `${inactiveActiveUsers.length} active users have not logged in for 30+ days`,
        count: inactiveActiveUsers.length,
        details: {
          userIds: inactiveActiveUsers.map((u: any) => u._id.toString()),
        },
      });
    }

    // Check for suspicious activity patterns (same IP, multiple users)
    const suspiciousIPs = await activityCollection
      .aggregate([
        {
          $match: {
            ...orgQuery,
            createdAt: { $gte: startDate },
            ipAddress: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$ipAddress',
            userCount: { $addToSet: '$userId' },
            actionCount: { $sum: 1 },
          },
        },
        {
          $match: {
            $expr: { $gt: [{ $size: '$userCount' }, 5] }, // Same IP, 5+ different users
          },
        },
        { $sort: { actionCount: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    suspiciousIPs.forEach((ip) => {
      alerts.push({
        type: 'suspicious_ip',
        severity: 'medium',
        message: `IP address ${ip._id} accessed ${ip.userCount.length} different user accounts`,
        count: ip.userCount.length,
        details: {
          ipAddress: ip._id,
          actionCount: ip.actionCount,
        },
      });
    });

    return NextResponse.json({
      alerts: alerts.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }),
      total: alerts.length,
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch security alerts' }, { status: 500 });
  }
}

