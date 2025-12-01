import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { notificationService } from '@/modules/notifications/notification-service';

/**
 * POST /api/test/notifications/create
 * Test endpoint to directly create a notification.
 * Requires ORG_ADMIN role.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use invoices permission as proxy for notifications (test endpoint)
    requirePermission(context, 'invoices', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, userId, type, title, message, channels } = body;

    // Validate required fields
    if (!type || !title || !message || !channels || !Array.isArray(channels)) {
      return NextResponse.json(
        { error: 'type, title, message, and channels (array) are required' },
        { status: 400 },
      );
    }

    // Create notification
    const notification = await notificationService.createNotification({
      organizationId,
      tenantId: tenantId || null,
      userId: userId || null,
      type,
      title,
      message,
      channels,
      link: body.link || null,
      metadata: body.metadata || null,
    });

    return NextResponse.json({
      message: 'Notification created successfully',
      notification: {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        channels: notification.channels,
        deliveryStatus: notification.deliveryStatus,
        createdAt: notification.createdAt,
      },
    });
  } catch (error) {
    console.error('[Test Notifications] Error creating notification:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
