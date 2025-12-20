import { getNotificationsCollection } from '@/lib/notifications/notifications';
import type { NotificationType, NotificationChannel } from '@/lib/notifications/notifications';

export interface NotificationStatistics {
  total: number;
  byType: Record<NotificationType, number>;
  byChannel: Record<
    NotificationChannel,
    {
      sent: number;
      delivered: number;
      failed: number;
      read?: number; // For in_app channel
    }
  >;
  deliveryRate: number; // Overall delivery rate percentage
  readRate: number; // Overall read rate percentage (in_app)
}

export interface NotificationTrendDataPoint {
  period: string; // e.g., "2024-01", "2024-Q1"
  total: number;
  delivered: number;
  read: number;
}

/**
 * Helper to format date to period string.
 */
function formatPeriod(date: Date, periodType: 'daily' | 'monthly' | 'quarterly'): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;

  switch (periodType) {
    case 'daily':
      return `${year}-${month.toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month.toString().padStart(2, '0')}`;
    case 'quarterly':
      return `${year}-Q${quarter}`;
    default:
      return `${year}`;
  }
}

/**
 * Get notification statistics for an organization.
 */
export async function getNotificationStatistics(
  organizationId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<NotificationStatistics> {
  const collection = await getNotificationsCollection();

  const filters: Record<string, unknown> = {
    organizationId,
  };

  if (startDate) {
    filters.createdAt = { $gte: startDate };
  }
  if (endDate) {
    filters.createdAt = { ...filters.createdAt, $lte: endDate };
  }

  const notifications = await collection.find(filters as any).toArray();

  const stats: NotificationStatistics = {
    total: notifications.length,
    byType: {} as Record<NotificationType, number>,
    byChannel: {
      in_app: { sent: 0, delivered: 0, failed: 0, read: 0 },
      email: { sent: 0, delivered: 0, failed: 0 },
      sms: { sent: 0, delivered: 0, failed: 0 },
      push: { sent: 0, delivered: 0, failed: 0 },
    },
    deliveryRate: 0,
    readRate: 0,
  };

  let totalSent = 0;
  let totalDelivered = 0;
  let totalRead = 0;

  for (const notification of notifications) {
    // Count by type
    if (!stats.byType[notification.type]) {
      stats.byType[notification.type] = 0;
    }
    stats.byType[notification.type]++;

    // Count by channel
    for (const channel of notification.channels) {
      const channelStats = stats.byChannel[channel];
      if (channelStats) {
        const deliveryStatus = notification.deliveryStatus[channel];
        if (deliveryStatus) {
          if ('sent' in deliveryStatus && deliveryStatus.sent) {
            channelStats.sent++;
            totalSent++;

            if ('delivered' in deliveryStatus && deliveryStatus.delivered) {
              channelStats.delivered++;
              totalDelivered++;
            } else if (deliveryStatus.error) {
              channelStats.failed++;
            }

            // For in_app channel, track read status
            if (channel === 'in_app' && 'read' in deliveryStatus && deliveryStatus.read) {
              channelStats.read = (channelStats.read || 0) + 1;
              totalRead++;
            }
          }
        }
      }
    }
  }

  // Calculate rates
  stats.deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  const inAppSent = stats.byChannel.in_app.sent;
  stats.readRate = inAppSent > 0 ? Math.round((totalRead / inAppSent) * 100) : 0;

  return stats;
}

/**
 * Get notification trends over time.
 */
export async function getNotificationTrends(
  organizationId: string,
  periodType: 'daily' | 'monthly' | 'quarterly' = 'monthly',
  numPeriods: number = 12,
): Promise<NotificationTrendDataPoint[]> {
  const collection = await getNotificationsCollection();

  const filters: Record<string, unknown> = {
    organizationId,
  };

  const notifications = await collection.find(filters as any).toArray();

  const trendMap: Record<string, { total: number; delivered: number; read: number }> = {};

  for (const notification of notifications) {
    const period = formatPeriod(notification.createdAt, periodType);

    if (!trendMap[period]) {
      trendMap[period] = { total: 0, delivered: 0, read: 0 };
    }

    trendMap[period].total++;

    // Count delivered
    let delivered = false;
    for (const channel of notification.channels) {
      const deliveryStatus = notification.deliveryStatus[channel];
      if (deliveryStatus && 'delivered' in deliveryStatus && deliveryStatus.delivered) {
        delivered = true;
        break;
      }
    }
    if (delivered) {
      trendMap[period].delivered++;
    }

    // Count read (in_app only)
    const inAppStatus = notification.deliveryStatus.in_app;
    if (inAppStatus && inAppStatus.read) {
      trendMap[period].read++;
    }
  }

  const trends: NotificationTrendDataPoint[] = [];
  const now = new Date();

  for (let i = 0; i < numPeriods; i++) {
    const date = new Date(now);
    if (periodType === 'daily') date.setDate(now.getDate() - i);
    if (periodType === 'monthly') date.setMonth(now.getMonth() - i);
    if (periodType === 'quarterly') date.setMonth(now.getMonth() - i * 3);

    const period = formatPeriod(date, periodType);
    const data = trendMap[period] || { total: 0, delivered: 0, read: 0 };

    trends.unshift({
      period,
      total: data.total,
      delivered: data.delivered,
      read: data.read,
    });
  }

  return trends;
}

