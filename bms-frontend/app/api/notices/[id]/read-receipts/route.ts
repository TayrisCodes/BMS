import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findNoticeById } from '@/lib/notices/notices';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/notices/[id]/read-receipts
 * Get read receipts for a notice (org_admin only).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'read');

    const notice = await findNoticeById(params.id, context.organizationId);

    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, notice.organizationId);

    return NextResponse.json({ readReceipts: notice.readReceipts || [] });
  } catch (error) {
    console.error('Failed to fetch read receipts:', error);
    return NextResponse.json({ error: 'Failed to fetch read receipts' }, { status: 500 });
  }
}
