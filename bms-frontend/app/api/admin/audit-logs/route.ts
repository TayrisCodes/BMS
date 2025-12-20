import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getUserActivityLogsCollection } from '@/lib/users/user-activity-logs';
import { findUserById } from '@/lib/auth/users';
import type { UserActivityAction } from '@/lib/users/user-activity-logs';
import { ObjectId } from 'mongodb';

/**
 * GET /api/admin/audit-logs
 * Get all activity logs (audit trail) across the system.
 * Query params: userId, organizationId, action, startDate, endDate, limit, offset
 * Requires SUPER_ADMIN or AUDITOR role.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN and AUDITOR can view audit logs
    const canViewAuditLogs = isSuperAdmin(context) || context.roles.includes('AUDITOR');
    if (!canViewAuditLogs) {
      return NextResponse.json(
        { error: 'Access denied: Audit logs require SUPER_ADMIN or AUDITOR role' },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');
    const action = searchParams.get('action') as UserActivityAction | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const query: Record<string, unknown> = {};

    if (userId) {
      // Validate user exists
      const user = await findUserById(userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      query.userId = new ObjectId(userId);
    }

    // For AUDITOR (non-SUPER_ADMIN), restrict to their organization
    if (!isSuperAdmin(context) && context.organizationId) {
      query.organizationId = context.organizationId;
    } else if (organizationId) {
      query.organizationId = organizationId;
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

    // Execute query with limit, offset, and sort
    const logs = await collection
      .find(query as any)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await collection.countDocuments(query as any);

    // Fetch user details for each log
    const logsWithUserDetails = await Promise.all(
      logs.map(async (log) => {
        let userName = 'Unknown User';
        let userEmail = null;
        let userPhone = null;

        try {
          if (log.userId) {
            const user = await findUserById(log.userId.toString());
            if (user) {
              userName = user.name || user.email || user.phone || 'Unknown User';
              userEmail = user.email || null;
              userPhone = user.phone || null;
            }
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
        }

        return {
          id: log._id.toString(),
          userId: log.userId?.toString() || null,
          userName,
          userEmail,
          userPhone,
          organizationId: log.organizationId || null,
          action: log.action,
          details: log.details,
          ipAddress: log.ipAddress || null,
          userAgent: log.userAgent || null,
          createdAt: log.createdAt.toISOString(),
        };
      }),
    );

    return NextResponse.json({
      logs: logsWithUserDetails,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

