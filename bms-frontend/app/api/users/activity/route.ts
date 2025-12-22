import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getUserActivityLogsCollection } from '@/lib/users/user-activity-logs';
import { getDb } from '@/lib/db';
import type { UserActivityAction } from '@/lib/users/user-activity-logs';
import { ObjectId } from 'mongodb';

/**
 * GET /api/users/activity
 * Get cross-organization activity logs for SUPER_ADMIN.
 * Query params: organizationId, userId, action, startDate, endDate, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can access cross-organization activity logs
    if (!isSuperAdmin(context)) {
      return NextResponse.json(
        { error: 'Access denied: SUPER_ADMIN permission required' },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') as UserActivityAction | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    const query: Record<string, unknown> = {};

    if (organizationId) {
      query.organizationId = organizationId;
    }

    if (userId) {
      query.userId = new ObjectId(userId);
    }

    if (action) {
      query.action = action;
    }

    if (startDateStr) {
      const startDate = new Date(startDateStr);
      if (!isNaN(startDate.getTime())) {
        query.createdAt = {
          ...((query.createdAt as Record<string, unknown>) || {}),
          $gte: startDate,
        };
      }
    }

    if (endDateStr) {
      const endDate = new Date(endDateStr);
      if (!isNaN(endDate.getTime())) {
        query.createdAt = {
          ...((query.createdAt as Record<string, unknown>) || {}),
          $lte: endDate,
        };
      }
    }

    const collection = await getUserActivityLogsCollection();
    const db = await getDb();

    // Get total count for pagination
    const total = await collection.countDocuments(query as any);

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and sort
    const logs = await collection
      .find(query as any)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get user and organization names for display
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))];
    const orgIds = [...new Set(logs.map((l) => l.organizationId).filter(Boolean))];

    const [users, orgs] = await Promise.all([
      userIds.length > 0
        ? db
            .collection('users')
            .find({
              _id: { $in: userIds.map((id) => new ObjectId(id as string)) },
            })
            .toArray()
        : [],
      orgIds.length > 0
        ? db
            .collection('organizations')
            .find({
              _id: { $in: orgIds.map((id) => new ObjectId(id as string)) },
            })
            .toArray()
        : [],
    ]);

    const userMap = new Map<string, { name?: string; email?: string; phone?: string }>();
    users.forEach((user: any) => {
      userMap.set(user._id.toString(), {
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    });

    const orgMap = new Map<string, string>();
    orgs.forEach((org: any) => {
      orgMap.set(org._id.toString(), org.name || 'Unknown');
    });

    // Get aggregated statistics
    const actionStats = await collection
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    return NextResponse.json({
      logs: logs.map((log) => {
        const userInfo = userMap.get(log.userId as string);
        return {
          id: log._id?.toString(),
          userId: log.userId,
          userName: userInfo?.name || userInfo?.email || userInfo?.phone || 'Unknown',
          organizationId: log.organizationId,
          organizationName: log.organizationId ? orgMap.get(log.organizationId) || null : null,
          action: log.action,
          details: log.details,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt.toISOString(),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statistics: {
        byAction: actionStats.reduce(
          (acc, stat) => {
            acc[stat._id as string] = stat.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}
