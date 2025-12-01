import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { notificationService } from '@/modules/notifications/notification-service';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = context.organizationId;

    // Get notifications for the user or tenant
    const notifications = await notificationService.getNotifications(
      context.userId,
      context.tenantId,
      organizationId || undefined,
      20,
    );

    // Format notifications for response
    const formattedNotifications = notifications.map((notif) => ({
      id: notif._id.toString(),
      type: notif.type,
      title: notif.title,
      message: notif.message,
      read: notif.deliveryStatus.in_app?.read || false,
      readAt: notif.deliveryStatus.in_app?.readAt || null,
      link: notif.link,
      createdAt: notif.createdAt,
      deliveryStatus: notif.deliveryStatus,
      metadata: notif.metadata,
    }));

    // Get unread count
    const unreadCount = await notificationService.getUnreadCount(
      context.userId,
      context.tenantId,
      organizationId || undefined,
    );

    return NextResponse.json({
      notifications: formattedNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
