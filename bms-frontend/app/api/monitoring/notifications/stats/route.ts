import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { getNotificationsCollection } from '@/lib/notifications/notifications';

/**
 * GET /api/monitoring/notifications/stats
 * Get notification delivery statistics for monitoring.
 * Requires ORG_ADMIN or SUPER_ADMIN role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require admin permission
    requirePermission(context, 'invoices', 'read'); // Using invoices permission as proxy

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const collection = await getNotificationsCollection();
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get notification statistics
    const [
      totalNotifications,
      last24HoursCount,
      last7DaysCount,
      inAppStats,
      emailStats,
      smsStats,
      byType,
      failedDeliveries,
    ] = await Promise.all([
      // Total notifications
      collection.countDocuments({ organizationId } as any),

      // Last 24 hours
      collection.countDocuments({
        organizationId,
        createdAt: { $gte: last24Hours },
      } as any),

      // Last 7 days
      collection.countDocuments({
        organizationId,
        createdAt: { $gte: last7Days },
      } as any),

      // In-app delivery stats
      collection.countDocuments({
        organizationId,
        channels: 'in_app',
        'deliveryStatus.in_app.sent': true,
      } as any),

      // Email delivery stats
      collection.countDocuments({
        organizationId,
        channels: 'email',
        'deliveryStatus.email.sent': true,
        'deliveryStatus.email.delivered': true,
      } as any),

      // SMS/WhatsApp delivery stats
      collection.countDocuments({
        organizationId,
        channels: 'sms',
        'deliveryStatus.sms.sent': true,
        'deliveryStatus.sms.delivered': true,
      } as any),

      // Notifications by type
      collection
        .aggregate([
          { $match: { organizationId } as any },
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),

      // Failed deliveries
      collection.countDocuments({
        organizationId,
        $or: [
          { 'deliveryStatus.email.error': { $exists: true, $ne: null } },
          { 'deliveryStatus.sms.error': { $exists: true, $ne: null } },
        ],
      } as any),
    ]);

    // Calculate delivery rates
    const emailTotal = await collection.countDocuments({
      organizationId,
      channels: 'email',
      'deliveryStatus.email.sent': true,
    } as any);

    const smsTotal = await collection.countDocuments({
      organizationId,
      channels: 'sms',
      'deliveryStatus.sms.sent': true,
    } as any);

    const emailDeliveryRate = emailTotal > 0 ? (emailStats / emailTotal) * 100 : 0;
    const smsDeliveryRate = smsTotal > 0 ? (smsStats / smsTotal) * 100 : 0;

    return NextResponse.json({
      summary: {
        total: totalNotifications,
        last24Hours: last24HoursCount,
        last7Days: last7DaysCount,
      },
      delivery: {
        inApp: {
          sent: inAppStats,
        },
        email: {
          sent: emailTotal,
          delivered: emailStats,
          deliveryRate: Math.round(emailDeliveryRate * 100) / 100,
        },
        sms: {
          sent: smsTotal,
          delivered: smsStats,
          deliveryRate: Math.round(smsDeliveryRate * 100) / 100,
        },
      },
      byType: byType.map((item: any) => ({
        type: item._id,
        count: item.count,
      })),
      errors: {
        failedDeliveries,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[Monitoring] Error getting notification stats:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to get notification statistics' }, { status: 500 });
  }
}
