import { Db, ObjectId } from 'mongodb';
import { getDb } from '../db';
import type { Conversation, Message } from '../types/conversation';

/**
 * Initialize indexes for conversations and messages collections
 * Call this once during app startup or in a migration script
 */
export async function initializeConversationIndexes(): Promise<void> {
  const db = await getDb();

  // Create indexes for conversations collection
  const conversationsCollection = db.collection('conversations');
  await conversationsCollection.createIndex({ organizationId: 1, tenantId: 1 });
  await conversationsCollection.createIndex({ organizationId: 1, buildingManagerId: 1 });
  await conversationsCollection.createIndex({ buildingId: 1 });
  await conversationsCollection.createIndex({ status: 1, lastMessageAt: -1 });
  await conversationsCollection.createIndex({ tenantId: 1, status: 1 });

  // Create indexes for messages collection
  const messagesCollection = db.collection('messages');
  await messagesCollection.createIndex({ conversationId: 1, createdAt: -1 });
  await messagesCollection.createIndex({ senderId: 1 });
  await messagesCollection.createIndex({ conversationId: 1, readAt: 1 });
}

/**
 * Get conversations collection
 */
export async function getConversationsCollection() {
  const db = await getDb();
  return db.collection('conversations');
}

/**
 * Get messages collection
 */
export async function getMessagesCollection() {
  const db = await getDb();
  return db.collection<Message>('messages');
}
