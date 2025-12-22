import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findNoticeById, updateNotice, deleteNotice } from '@/lib/notices/notices';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/notices/[id]
 * Fetches a single notice.
 * Requires notices.read permission.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'read');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const notice = await findNoticeById(params.id, context.organizationId);
    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }
    validateOrganizationAccess(context, notice.organizationId);

    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    return NextResponse.json({ notice });
  } catch (error) {
    console.error('Failed to fetch notice:', error);
    return NextResponse.json({ error: 'Failed to fetch notice' }, { status: 500 });
  }
}

/**
 * PUT /api/notices/[id]
 * Updates a notice.
 * Requires notices.update permission (org_admin only).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'update');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const updates = await request.json();

    const notice = await findNoticeById(params.id, context.organizationId);
    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }
    validateOrganizationAccess(context, notice.organizationId);

    const updatedNotice = await updateNotice(params.id, context.organizationId, updates);

    if (!updatedNotice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    return NextResponse.json({ notice: updatedNotice });
  } catch (error) {
    console.error('Failed to update notice:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/notices/[id]
 * Deletes a notice.
 * Requires notices.delete permission (org_admin only).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'delete');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const notice = await findNoticeById(params.id, context.organizationId);
    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }
    validateOrganizationAccess(context, notice.organizationId);

    const deleted = await deleteNotice(params.id, context.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('Failed to delete notice:', error);
    return NextResponse.json({ error: 'Failed to delete notice' }, { status: 500 });
  }
}
