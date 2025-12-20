import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { getIncidentAnalytics } from '@/modules/security/incident-analytics';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER'];

/**
 * GET /api/security/incidents/analytics
 * Get incident analytics for a building or organization.
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

    const dateRange =
      startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined;

    const analytics = await getIncidentAnalytics(
      buildingId || null,
      context.organizationId,
      dateRange,
      periodMonths,
    );

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Incident analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch incident analytics' }, { status: 500 });
  }
}
