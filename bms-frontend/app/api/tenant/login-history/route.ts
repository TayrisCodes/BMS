import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import {
  getUserActivityLogsCollection,
  type UserActivityAction,
} from '@/lib/users/user-activity-logs';

const ALLOWED_ACTIONS: UserActivityAction[] = ['login', 'logout'];
const MAX_LIMIT = 100;

/**
 * GET /api/tenant/login-history
 * Returns recent login/logout events for the authenticated tenant user.
 * Query params: page (default 1), limit (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)),
    );
    const skip = (page - 1) * limit;

    const collection = await getUserActivityLogsCollection();

    const query = {
      userId: context.userId,
      action: { $in: ALLOWED_ACTIONS },
    };

    const total = await collection.countDocuments(query);
    const logs = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log._id?.toString(),
        action: log.action,
        createdAt: log.createdAt,
        ipAddress: log.ipAddress || null,
        userAgent: log.userAgent || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Tenant login history error:', error);
    return NextResponse.json({ error: 'Failed to fetch login history' }, { status: 500 });
  }
}
