import { NotificationService } from '@/modules/notifications/notification-service';
import { listLeases, updateLease, type Lease } from '@/lib/leases/leases';

const DEFAULT_WINDOWS = [60, 30, 7];
const DAY_MS = 1000 * 60 * 60 * 24;

function pickWindow(daysUntil: number, windows: number[]): number | null {
  const match = windows.find((w) => daysUntil <= w && daysUntil >= w - 1);
  return match ?? null;
}

export async function runLeaseExpiryReminders(
  organizationId: string,
  asOf: Date = new Date(),
  windows: number[] = DEFAULT_WINDOWS,
) {
  const notificationService = new NotificationService();
  const leases = await listLeases({
    organizationId,
    status: 'active',
    endDate: { $ne: null },
  });

  for (const lease of leases) {
    if (!lease.endDate) continue;
    const daysUntil = Math.ceil((new Date(lease.endDate).getTime() - asOf.getTime()) / DAY_MS);
    const matchedWindow = pickWindow(daysUntil, windows);
    if (matchedWindow === null) continue;

    if (
      lease.reminderLastWindowDays === matchedWindow &&
      lease.reminderLastSentAt &&
      new Date(lease.reminderLastSentAt).getTime() > asOf.getTime() - DAY_MS
    ) {
      // Avoid duplicate sends within a day for same window
      continue;
    }

    const title = 'Lease expiring soon';
    const message = `Your lease is expiring in ${matchedWindow} day(s). Please review renewal options.`;

    await notificationService
      .createNotification({
        organizationId,
        tenantId: lease.tenantId,
        type: 'lease_expiring',
        title,
        message,
        channels: ['in_app', 'email'],
        metadata: {
          leaseId: lease._id,
          endDate: lease.endDate,
          daysUntil,
        },
        link: `/tenant/leases/${lease._id}`,
      })
      .catch((err) => {
        console.error('Failed to send lease expiry notification', lease._id, err);
      });

    await updateLease(lease._id, {
      reminderLastSentAt: asOf,
      reminderLastWindowDays: matchedWindow,
    }).catch((err) => {
      console.error('Failed to update lease reminder metadata', lease._id, err);
    });
  }
}

