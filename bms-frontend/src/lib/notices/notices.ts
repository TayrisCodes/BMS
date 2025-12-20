import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUserById } from '@/lib/auth/users';

const NOTICES_COLLECTION_NAME = 'notices';

export type NoticeType = 'announcement' | 'emergency' | 'maintenance' | 'general';
export type NoticePriority = 'normal' | 'high' | 'urgent';
export type NoticeTargetAudience = 'all' | 'building' | 'floor' | 'unit' | 'tenant_type';

export interface NoticeTargeting {
  audience: NoticeTargetAudience;
  buildingId?: string | null;
  floor?: number | null;
  unitId?: string | null;
  tenantType?: 'residential' | 'commercial' | null;
  specificTenantIds?: string[] | null;
}

export interface NoticeReadReceipt {
  userId?: string | null;
  tenantId?: string | null;
  readAt: Date;
}

export interface Notice {
  _id: string;
  organizationId: string;
  buildingId?: string | null; // Optional for building-specific notices
  title: string;
  content: string; // Rich text content
  type: NoticeType;
  priority: NoticePriority;
  targeting: NoticeTargeting;
  publishedBy: string; // ObjectId ref to users
  publishedAt: Date;
  expiryDate?: Date | null;
  attachments?: string[] | null; // URLs or file paths
  readReceipts?: NoticeReadReceipt[] | null;
  multiLanguageContent?: Record<string, { title: string; content: string }> | null; // Language code -> content
  createdAt: Date;
  updatedAt: Date;
}

export async function getNoticesCollection(): Promise<Collection<Notice>> {
  const db = await getDb();
  return db.collection<Notice>(NOTICES_COLLECTION_NAME);
}

export async function ensureNoticeIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(NOTICES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and publishedAt
    {
      key: { organizationId: 1, buildingId: 1, publishedAt: -1 },
      name: 'org_building_publishedAt',
    },
    // Index on type
    {
      key: { type: 1 },
      name: 'type',
    },
    // Index on priority
    {
      key: { priority: 1 },
      name: 'priority',
    },
    // Index on expiryDate for cleanup
    {
      key: { expiryDate: 1 },
      sparse: true,
      name: 'expiryDate',
    },
    // Index on publishedAt
    {
      key: { publishedAt: -1 },
      name: 'publishedAt',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a building exists and belongs to the same organization (if provided).
 */
async function validateBuildingBelongsToOrg(
  buildingId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!buildingId) {
    return;
  }

  const building = await findBuildingById(buildingId, organizationId);
  if (!building) {
    throw new Error('Building not found');
  }
  if (building.organizationId !== organizationId) {
    throw new Error('Building does not belong to the same organization');
  }
}

export interface CreateNoticeInput {
  organizationId: string;
  buildingId?: string | null;
  title: string;
  content: string;
  type: NoticeType;
  priority: NoticePriority;
  targeting: NoticeTargeting;
  publishedBy: string;
  expiryDate?: Date | null;
  attachments?: string[] | null;
  multiLanguageContent?: Record<string, { title: string; content: string }> | null;
}

export async function createNotice(input: CreateNoticeInput): Promise<Notice> {
  const collection = await getNoticesCollection();
  const now = new Date();

  // Validate building if provided
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate publishedBy user
  const publishedByUser = await findUserById(input.publishedBy);
  if (!publishedByUser || publishedByUser.organizationId !== input.organizationId) {
    throw new Error('Publisher user not found or does not belong to the organization');
  }

  // Validate required fields
  if (!input.title || !input.content || !input.type || !input.priority) {
    throw new Error('title, content, type, and priority are required');
  }

  const doc: Omit<Notice, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId ?? null,
    title: input.title.trim(),
    content: input.content.trim(),
    type: input.type,
    priority: input.priority,
    targeting: input.targeting,
    publishedBy: input.publishedBy,
    publishedAt: now,
    expiryDate: input.expiryDate ?? null,
    attachments: input.attachments ?? null,
    readReceipts: [],
    multiLanguageContent: input.multiLanguageContent ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Notice>);

  return {
    ...(doc as Notice),
    _id: result.insertedId.toString(),
  } as Notice;
}

export async function findNoticeById(
  noticeId: string,
  organizationId?: string,
): Promise<Notice | null> {
  const collection = await getNoticesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(noticeId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

interface UpdateNoticeInput
  extends Partial<
    Omit<Notice, '_id' | 'organizationId' | 'publishedBy' | 'publishedAt' | 'createdAt'>
  > {}

export async function updateNotice(
  noticeId: string,
  organizationId: string,
  updates: UpdateNoticeInput,
): Promise<Notice | null> {
  const collection = await getNoticesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingNotice = await findNoticeById(noticeId, organizationId);
    if (!existingNotice) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Validate building if being updated
    if (updateDoc.buildingId !== undefined && updateDoc.buildingId !== existingNotice.buildingId) {
      await validateBuildingBelongsToOrg(updateDoc.buildingId as string | null, organizationId);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(noticeId), organizationId },
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result as Notice | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listNotices(
  organizationId: string,
  filters: Record<string, unknown> = {},
): Promise<Notice[]> {
  const collection = await getNoticesCollection();
  const now = new Date();

  // Filter out expired notices by default
  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
    $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }],
  };

  return collection
    .find(query as Document)
    .sort({ publishedAt: -1 })
    .toArray();
}

/**
 * Determine if a notice should be shown to a tenant/user.
 */
export async function shouldShowNoticeToTenant(
  notice: Notice,
  tenantId: string,
  unitId?: string | null,
  buildingId?: string | null,
  tenantType?: 'residential' | 'commercial' | null,
  floor?: number | null,
): Promise<boolean> {
  const { targeting } = notice;

  // Check if notice is expired
  if (notice.expiryDate && new Date(notice.expiryDate) < new Date()) {
    return false;
  }

  // Check targeting audience
  if (targeting.audience === 'all') {
    return true;
  }

  if (targeting.audience === 'building' && targeting.buildingId) {
    return buildingId === targeting.buildingId;
  }

  if (targeting.audience === 'floor' && targeting.floor !== undefined && targeting.floor !== null) {
    return floor === targeting.floor && buildingId === targeting.buildingId;
  }

  if (targeting.audience === 'unit' && targeting.unitId) {
    return unitId === targeting.unitId;
  }

  if (targeting.audience === 'tenant_type' && targeting.tenantType) {
    return tenantType === targeting.tenantType;
  }

  // Check specific tenant IDs if provided
  if (targeting.specificTenantIds && targeting.specificTenantIds.length > 0) {
    return targeting.specificTenantIds.includes(tenantId);
  }

  return false;
}

/**
 * Mark a notice as read by a tenant or user.
 */
export async function markNoticeAsRead(
  noticeId: string,
  userId?: string | null,
  tenantId?: string | null,
): Promise<boolean> {
  const collection = await getNoticesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const notice = await findNoticeById(noticeId);
    if (!notice) {
      return false;
    }

    // Check if already read
    const existingReceipt = notice.readReceipts?.find(
      (r) => (userId && r.userId === userId) || (tenantId && r.tenantId === tenantId),
    );

    if (existingReceipt) {
      return true; // Already read
    }

    // Add read receipt
    const newReceipt: NoticeReadReceipt = {
      userId: userId ?? null,
      tenantId: tenantId ?? null,
      readAt: new Date(),
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(noticeId) } as Document,
      {
        $push: { readReceipts: newReceipt },
        $set: { updatedAt: new Date() },
      } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function deleteNotice(noticeId: string, organizationId: string): Promise<boolean> {
  const collection = await getNoticesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const result = await collection.deleteOne({ _id: new ObjectId(noticeId), organizationId });
    return result.deletedCount === 1;
  } catch {
    return false;
  }
}

