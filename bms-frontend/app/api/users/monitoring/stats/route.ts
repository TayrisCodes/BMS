import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getUserActivityLogsCollection } from '@/lib/users/user-activity-logs';
import { getUsersCollection } from '@/lib/auth/users';
import { withOptionalOrganizationScope } from '@/lib/organizations/scoping';
import { getDb } from '@/lib/db';

/**
 * GET /api/users/monitoring/stats
 * Get activity statistics for organization (ORG_ADMIN scoped).
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
    const days = parseInt(searchParams.get('days') || '30', 10);

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

    // Get activity statistics
    const activityStats = await activityCollection
      .aggregate([
        {
          $match: {
            ...orgQuery,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Get user activity counts
    const userActivityCounts = await activityCollection
      .aggregate([
        {
          $match: {
            ...orgQuery,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            lastActivity: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Get user details for top active users
    const userIds = userActivityCounts.map((u) => u._id).filter(Boolean);
    const { ObjectId } = await import('mongodb');
    const userIdObjects = userIds.map((id) => new ObjectId(id as string));
    const users = await usersCollection
      .find({
        _id: { $in: userIdObjects },
      } as any)
      .toArray();

    const userMap = new Map<string, any>();
    users.forEach((user: any) => {
      userMap.set(user._id.toString(), {
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    });

    // Get total activity count
    const totalActivities = await activityCollection.countDocuments({
      ...orgQuery,
      createdAt: { $gte: startDate },
    });

    // Get active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await usersCollection.countDocuments({
      ...orgQuery,
      lastLoginAt: { $gte: thirtyDaysAgo },
      status: 'active',
    });

    // Get inactive users (no login in last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const inactiveUsers = await usersCollection.countDocuments({
      ...orgQuery,
      $or: [{ lastLoginAt: { $lt: ninetyDaysAgo } }, { lastLoginAt: null }],
      status: 'active',
    });

    // Get total users
    const totalUsers = await usersCollection.countDocuments({
      ...orgQuery,
      status: 'active',
    });

    return NextResponse.json({
      overview: {
        totalActivities,
        activeUsers,
        inactiveUsers,
        totalUsers,
      },
      byAction: activityStats.reduce(
        (acc, stat) => {
          acc[stat._id as string] = stat.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      topActiveUsers: userActivityCounts.map((stat) => ({
        userId: stat._id,
        userName:
          userMap.get(stat._id as string)?.name ||
          userMap.get(stat._id as string)?.email ||
          'Unknown',
        activityCount: stat.count,
        lastActivity: stat.lastActivity,
      })),
    });
  } catch (error) {
    console.error('Activity stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity statistics' }, { status: 500 });
  }
}
