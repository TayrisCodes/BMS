import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { findUserById } from '@/lib/auth/users';
import { getUserActivityLogsCollection } from '@/lib/users/user-activity-logs';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import type { UserActivityAction } from '@/lib/users/user-activity-logs';
import { ObjectId } from 'mongodb';

/**
 * GET /api/users/[id]/activity
 * Get user activity logs.
 * Query params: action, startDate, endDate, limit
 * Requires permission to view user activity (ORG_ADMIN or user viewing own activity).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const searchParams = request.nextUrl.searchParams;

    // Get existing user to check organization access
    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions: user can view own activity, ORG_ADMIN/SUPER_ADMIN can view any user's activity
    const isOwnActivity = context.userId === userId;
    const canViewOthers = isSuperAdmin(context) || context.roles.includes('ORG_ADMIN');

    if (!isOwnActivity && !canViewOthers) {
      return NextResponse.json(
        { error: 'Access denied: You can only view your own activity' },
        { status: 403 },
      );
    }

    // Verify user belongs to same org (unless SUPER_ADMIN or viewing own activity)
    if (!isSuperAdmin(context) && !isOwnActivity) {
      validateOrganizationAccess(context, existingUser.organizationId);
    }

    // Parse query parameters
    const action = searchParams.get('action') as UserActivityAction | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    const query: Record<string, unknown> = {
      userId: new ObjectId(userId),
    };

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

    // Execute query with limit and sort
    const logs = await collection
      .find(query as any)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Get total count for pagination (optional)
    const total = await collection.countDocuments(query as any);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log._id.toString(),
        userId: log.userId,
        organizationId: log.organizationId,
        action: log.action,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      limit,
    });
  } catch (error) {
    console.error('Get user activity logs error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}
