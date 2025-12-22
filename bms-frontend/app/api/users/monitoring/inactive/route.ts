import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getUsersCollection } from '@/lib/auth/users';
import { withOptionalOrganizationScope } from '@/lib/organizations/scoping';

/**
 * GET /api/users/monitoring/inactive
 * Get inactive users (no login in X days).
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
    const days = parseInt(searchParams.get('days') || '90', 10);

    const collection = await getUsersCollection();

    // Build query for organization scoping
    let query: Record<string, unknown> = {};
    if (!isSuperAdmin(context)) {
      query = withOptionalOrganizationScope(context, {});
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find inactive users
    query.status = 'active';
    query.$or = [{ lastLoginAt: { $lt: cutoffDate } }, { lastLoginAt: null }];

    const inactiveUsers = await collection
      .find(query as any)
      .sort({ lastLoginAt: 1 }) // Oldest first
      .toArray();

    return NextResponse.json({
      inactiveUsers: inactiveUsers.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        roles: user.roles || [],
        lastLoginAt: user.lastLoginAt || null,
        daysSinceLastLogin: user.lastLoginAt
          ? Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      cutoffDays: days,
    });
  } catch (error) {
    console.error('Get inactive users error:', error);
    return NextResponse.json({ error: 'Failed to fetch inactive users' }, { status: 500 });
  }
}
