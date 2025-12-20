import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { getVisitorAnalytics } from '@/modules/security/visitor-analytics';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * GET /api/visitor-logs/analytics
 * Get visitor analytics for a building or organization.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission/role guard
    try {
      requirePermission(context, 'security', 'read');
    } catch {
      const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
      if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { searchParams } = request.nextUrl;
    const buildingId = searchParams.get('buildingId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12', 10);
    const topHostsLimit = parseInt(searchParams.get('topHostsLimit') || '10', 10);

    const dateRange =
      startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined;

    const analytics = await getVisitorAnalytics(
      buildingId || null,
      context.organizationId,
      dateRange,
      periodMonths,
      topHostsLimit,
    );

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Visitor analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch visitor analytics' }, { status: 500 });
  }
}
