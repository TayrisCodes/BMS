import type { Collection, Db, IndexDescription } from 'mongodb';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

const PUSH_SUBSCRIPTIONS_COLLECTION_NAME = 'pushSubscriptions';

export interface PushSubscription {
  _id: ObjectId;
  userId?: ObjectId | null;
  tenantId?: ObjectId | null;
  organizationId: ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export async function getPushSubscriptionsCollection(): Promise<Collection<PushSubscription>> {
  const db = await getDb();
  return db.collection<PushSubscription>(PUSH_SUBSCRIPTIONS_COLLECTION_NAME);
}

export async function ensurePushSubscriptionIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PUSH_SUBSCRIPTIONS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    { key: { endpoint: 1 }, unique: true },
    { key: { userId: 1 } },
    { key: { tenantId: 1 } },
    { key: { organizationId: 1 } },
    { key: { createdAt: -1 } },
  ];

  await collection.createIndexes(indexes);
}
