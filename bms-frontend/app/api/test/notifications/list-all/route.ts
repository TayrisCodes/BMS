import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { getNotificationsCollection } from '@/lib/notifications/notifications';

/**
 * GET /api/test/notifications/list-all
 * Test endpoint to list ALL notifications in the database (for debugging).
 * Requires ORG_ADMIN role.
 */
export async function GET(request: Request) {
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

    const collection = await getNotificationsCollection();

    // Get all notifications for this organization
    const allNotifications = await collection
      .find({ organizationId } as any)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Also get count
    const totalCount = await collection.countDocuments({ organizationId } as any);

    return NextResponse.json({
      totalCount,
      notifications: allNotifications.map((n) => ({
        _id: n._id.toString(),
        organizationId: n.organizationId,
        userId: n.userId,
        tenantId: n.tenantId,
        type: n.type,
        title: n.title,
        message: n.message,
        channels: n.channels,
        deliveryStatus: n.deliveryStatus,
        link: n.link,
        metadata: n.metadata,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[Test Notifications] Error listing notifications:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to list notifications' }, { status: 500 });
  }
}
