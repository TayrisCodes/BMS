import type { Collection, Db, IndexDescription, Document } from 'mongodb';
import { getDb } from '@/lib/db';

const NOTIFICATIONS_COLLECTION_NAME = 'notifications';

export type NotificationType =
  | 'invoice_created'
  | 'payment_due'
  | 'payment_received'
  | 'complaint_status_changed'
  | 'work_order_assigned'
  | 'work_order_completed'
  | 'lease_expiring'
  | 'visitor_arrived'
  | 'message_received'
  | 'conversation_archived'
  | 'conversation_closed'
  | 'system'
  | 'other';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface NotificationDeliveryStatus {
  in_app?: {
    sent: boolean;
    read: boolean;
    readAt?: Date | null;
  };
  email?: {
    sent: boolean;
    delivered: boolean;
    error?: string | null;
  };
  sms?: {
    sent: boolean;
    delivered: boolean;
    error?: string | null;
  };
  push?: {
    sent: boolean;
    delivered: boolean;
    error?: string | null;
  };
}

export interface Notification {
  _id: string;
  organizationId?: string | null; // Optional, for org-wide notifications
  userId?: string | null; // ObjectId ref to users (optional, for user-specific)
  tenantId?: string | null; // ObjectId ref to tenants (optional, for tenant-specific)
  type: NotificationType;
  title: string;
  message: string;
  channels: Array<NotificationChannel>; // Delivery channels
  deliveryStatus: NotificationDeliveryStatus;
  link?: string | null; // Deep link to relevant page
  metadata?: Record<string, unknown> | null; // Additional context
  createdAt: Date;
  updatedAt: Date;
}

export async function getNotificationsCollection(): Promise<Collection<Notification>> {
  const db = await getDb();
  return db.collection<Notification>(NOTIFICATIONS_COLLECTION_NAME);
}

export async function ensureNotificationIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(NOTIFICATIONS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on userId and read status for unread notifications
    {
      key: { userId: 1, 'deliveryStatus.in_app.read': 1, createdAt: -1 },
      name: 'user_unread_notifications',
      sparse: true,
    },
    // Compound index on tenantId and read status for unread notifications
    {
      key: { tenantId: 1, 'deliveryStatus.in_app.read': 1, createdAt: -1 },
      name: 'tenant_unread_notifications',
      sparse: true,
    },
    // Index on organizationId (sparse)
    {
      key: { organizationId: 1 },
      name: 'organizationId',
      sparse: true,
    },
    // Compound index on type and createdAt
    {
      key: { type: 1, createdAt: -1 },
      name: 'type_createdAt',
    },
    // Index on createdAt for sorting
    {
      key: { createdAt: -1 },
      name: 'createdAt',
    },
  ];

  await collection.createIndexes(indexes);
}
