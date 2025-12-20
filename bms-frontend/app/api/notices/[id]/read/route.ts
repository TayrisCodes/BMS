import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { markNoticeAsRead } from '@/lib/notices/notices';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/notices/[id]/read
 * Mark a notice as read by the current user/tenant.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await markNoticeAsRead(params.id, context.userId, context.tenantId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to mark notice as read' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Notice marked as read' });
  } catch (error) {
    console.error('Failed to mark notice as read:', error);
    return NextResponse.json({ error: 'Failed to mark notice as read' }, { status: 500 });
  }
}

