import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { createNotice, listNotices, type CreateNoticeInput } from '@/lib/notices/notices';
import { notificationService } from '@/modules/notifications/notification-service';

/**
 * GET /api/notices
 * Lists all notices for the organization, with optional filters.
 * Requires notices.read permission.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'read');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    validateOrganizationAccess(context, context.organizationId);

    const { searchParams } = request.nextUrl;
    const buildingId = searchParams.get('buildingId');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');

    const filters: Record<string, unknown> = {};
    if (buildingId) filters.buildingId = buildingId;
    if (type) filters.type = type;
    if (priority) filters.priority = priority;

    const notices = await listNotices(context.organizationId, filters);

    return NextResponse.json({ notices });
  } catch (error) {
    console.error('Failed to fetch notices:', error);
    return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
  }
}

/**
 * POST /api/notices
 * Creates a new notice.
 * Requires notices.create permission (org_admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'create');
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    validateOrganizationAccess(context, context.organizationId);

    const input: CreateNoticeInput = await request.json();

    const newNotice = await createNotice({
      ...input,
      organizationId: context.organizationId,
      publishedBy: context.userId,
    });

    // If urgent or high priority, send notifications to target audience
    if (newNotice.priority === 'urgent' || newNotice.priority === 'high') {
      try {
        // This would need to query tenants based on targeting
        // For now, we'll create a notification that can be picked up
        await notificationService.createNotification({
          organizationId: context.organizationId,
          type: 'system',
          title: `New ${newNotice.priority} priority notice: ${newNotice.title}`,
          message: newNotice.content.substring(0, 200),
          channels: ['in_app', 'email', 'sms'],
          link: `/tenant/notices/${newNotice._id}`,
          metadata: {
            noticeId: newNotice._id,
            noticeType: newNotice.type,
            priority: newNotice.priority,
          },
        });
      } catch (error) {
        console.error('Failed to send notice notification:', error);
        // Don't fail notice creation if notification fails
      }
    }

    return NextResponse.json({ notice: newNotice }, { status: 201 });
  } catch (error) {
    console.error('Failed to create notice:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
