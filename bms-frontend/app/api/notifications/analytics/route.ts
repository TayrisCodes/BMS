import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  getNotificationStatistics,
  getNotificationTrends,
} from '@/modules/notifications/analytics';

/**
 * GET /api/notifications/analytics
 * Get notification statistics and trends.
 * Requires notifications.read permission.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notifications', 'read');
    validateOrganizationAccess(context);

    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodType = (searchParams.get('periodType') || 'monthly') as
      | 'daily'
      | 'monthly'
      | 'quarterly';
    const numPeriods = parseInt(searchParams.get('numPeriods') || '12', 10);

    const statistics = await getNotificationStatistics(
      context.organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    const trends = await getNotificationTrends(context.organizationId, periodType, numPeriods);

    return NextResponse.json({
      statistics,
      trends,
    });
  } catch (error) {
    console.error('Failed to fetch notification analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch notification analytics' }, { status: 500 });
  }
}

