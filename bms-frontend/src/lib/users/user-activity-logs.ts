import type { Collection, Db, IndexDescription, Document } from 'mongodb';
import { getDb } from '@/lib/db';

export type UserActivityAction =
  | 'login'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'profile_update'
  | 'role_assigned'
  | 'role_removed'
  | 'status_changed'
  | 'user_created'
  | 'user_deleted'
  | 'user_invited'
  | 'user_activated'
  | 'permission_denied'
  | 'other';

export interface UserActivityLog {
  _id?: string;
  organizationId?: string | null;
  userId: string; // ObjectId ref to users
  action: UserActivityAction;
  details?: Record<string, unknown> | null; // Additional context
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

const USER_ACTIVITY_LOGS_COLLECTION_NAME = 'userActivityLogs';

export async function getUserActivityLogsCollection(): Promise<Collection<UserActivityLog>> {
  const db = await getDb();
  return db.collection<UserActivityLog>(USER_ACTIVITY_LOGS_COLLECTION_NAME);
}

/**
 * Ensure indexes are created for the user activity logs collection.
 */
export async function ensureUserActivityLogsIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());

  const collection = database.collection(USER_ACTIVITY_LOGS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on userId and createdAt (descending) for efficient user activity queries
    {
      key: { userId: 1, createdAt: -1 },
      name: 'userId_createdAt_desc',
    },
    // Compound index on organizationId, action, and createdAt for org-level activity queries
    {
      key: { organizationId: 1, action: 1, createdAt: -1 },
      name: 'orgId_action_createdAt_desc',
    },
    // Index on organizationId for org-scoped queries
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
    // Index on action for filtering by action type
    {
      key: { action: 1 },
      name: 'action',
    },
    // Index on createdAt for date range queries
    {
      key: { createdAt: -1 },
      name: 'createdAt_desc',
    },
  ];

  await collection.createIndexes(indexes);
}
