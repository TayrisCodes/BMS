import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { notificationService } from '@/modules/notifications/notification-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: notificationId } = await routeParams.params;

    if (!context.userId) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
    }

    const success = await notificationService.markAsRead(notificationId, context.userId);

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found or already read' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
