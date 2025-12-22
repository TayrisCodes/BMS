import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';

const MAINTENANCE_HISTORY_COLLECTION_NAME = 'maintenanceHistory';

export type MaintenanceType = 'preventive' | 'corrective' | 'emergency';

export interface MaintenanceHistory {
  _id: string;
  organizationId: string;
  assetId: string;
  workOrderId?: string | null; // ObjectId ref to work orders (optional)
  maintenanceType: MaintenanceType;
  performedBy?: string | null; // ObjectId ref to users (technician)
  performedDate: Date;
  description: string;
  cost?: number | null;
  partsUsed?: Array<{
    name: string;
    quantity: number;
    cost: number;
  }> | null;
  downtimeHours?: number | null;
  notes?: string | null;
  nextMaintenanceDue?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getMaintenanceHistoryCollection(): Promise<Collection<MaintenanceHistory>> {
  const db = await getDb();
  return db.collection<MaintenanceHistory>(MAINTENANCE_HISTORY_COLLECTION_NAME);
}

export async function ensureMaintenanceHistoryIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(MAINTENANCE_HISTORY_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId and assetId
    {
      key: { organizationId: 1, assetId: 1 },
      name: 'org_asset',
    },
    // Index on assetId for asset-specific queries
    {
      key: { assetId: 1 },
      name: 'assetId',
    },
    // Index on performedDate for time-based queries
    {
      key: { performedDate: -1 },
      name: 'performedDate',
    },
    // Sparse index on workOrderId
    {
      key: { workOrderId: 1 },
      sparse: true,
      name: 'workOrderId_sparse',
    },
    // Index on maintenanceType
    {
      key: { maintenanceType: 1 },
      name: 'maintenanceType',
    },
  ];

  await collection.createIndexes(indexes);
}

export interface CreateMaintenanceHistoryInput {
  organizationId: string;
  assetId: string;
  workOrderId?: string | null;
  maintenanceType: MaintenanceType;
  performedBy?: string | null;
  performedDate: Date | string;
  description: string;
  cost?: number | null;
  partsUsed?: Array<{
    name: string;
    quantity: number;
    cost: number;
  }> | null;
  downtimeHours?: number | null;
  notes?: string | null;
  nextMaintenanceDue?: Date | string | null;
}

export async function createMaintenanceHistory(
  input: CreateMaintenanceHistoryInput,
): Promise<MaintenanceHistory> {
  const collection = await getMaintenanceHistoryCollection();
  const now = new Date();

  // Validate asset exists
  const { findAssetById } = await import('./assets');
  const asset = await findAssetById(input.assetId, input.organizationId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  // Convert dates
  const performedDate =
    typeof input.performedDate === 'string' ? new Date(input.performedDate) : input.performedDate;
  const nextMaintenanceDue: Date | null =
    input.nextMaintenanceDue && typeof input.nextMaintenanceDue === 'string'
      ? new Date(input.nextMaintenanceDue)
      : input.nextMaintenanceDue instanceof Date
        ? input.nextMaintenanceDue
        : null;

  // Validate required fields
  if (!input.description || !input.description.trim()) {
    throw new Error('Description is required');
  }

  const doc: Omit<MaintenanceHistory, '_id'> = {
    organizationId: input.organizationId,
    assetId: input.assetId,
    workOrderId: input.workOrderId ?? null,
    maintenanceType: input.maintenanceType,
    performedBy: input.performedBy ?? null,
    performedDate,
    description: input.description.trim(),
    cost: input.cost ?? null,
    partsUsed: input.partsUsed ?? null,
    downtimeHours: input.downtimeHours ?? null,
    notes: input.notes?.trim() ?? null,
    nextMaintenanceDue,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<MaintenanceHistory>);

  // Update asset's last maintenance date
  const existingAsset = await findAssetById(input.assetId, input.organizationId);
  if (existingAsset) {
    const { updateAsset } = await import('./assets');
    await updateAsset(input.assetId, {
      maintenanceSchedule: {
        ...existingAsset.maintenanceSchedule,
        lastMaintenanceDate: performedDate,
        nextMaintenanceDate: nextMaintenanceDue,
      },
    });
  }

  return {
    ...(doc as MaintenanceHistory),
    _id: result.insertedId.toString(),
  } as MaintenanceHistory;
}

export async function findMaintenanceHistoryById(
  historyId: string,
  organizationId?: string,
): Promise<MaintenanceHistory | null> {
  const collection = await getMaintenanceHistoryCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(historyId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findMaintenanceHistoryByAsset(
  assetId: string,
  organizationId?: string,
  limit?: number,
): Promise<MaintenanceHistory[]> {
  const collection = await getMaintenanceHistoryCollection();

  const query: Record<string, unknown> = { assetId };
  if (organizationId) {
    query.organizationId = organizationId;
  }

  const cursor = collection.find(query as Document).sort({ performedDate: -1 });
  if (limit) {
    cursor.limit(limit);
  }

  return cursor.toArray();
}

export async function findMaintenanceHistoryByWorkOrder(
  workOrderId: string,
  organizationId?: string,
): Promise<MaintenanceHistory | null> {
  const collection = await getMaintenanceHistoryCollection();

  const query: Record<string, unknown> = { workOrderId };
  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

export async function listMaintenanceHistory(
  query: Record<string, unknown> = {},
): Promise<MaintenanceHistory[]> {
  const collection = await getMaintenanceHistoryCollection();

  return collection
    .find(query as Document)
    .sort({ performedDate: -1 })
    .toArray();
}

export async function updateMaintenanceHistory(
  historyId: string,
  updates: Partial<MaintenanceHistory>,
  organizationId?: string,
): Promise<MaintenanceHistory | null> {
  const collection = await getMaintenanceHistoryCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingHistory = await findMaintenanceHistoryById(historyId, organizationId);
    if (!existingHistory) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;

    // Trim string fields if present
    if (updateDoc.description && typeof updateDoc.description === 'string') {
      updateDoc.description = updateDoc.description.trim();
    }
    if (updateDoc.notes && typeof updateDoc.notes === 'string') {
      updateDoc.notes = updateDoc.notes.trim();
    }

    // Convert date strings to Date objects
    if (updateDoc.performedDate && typeof updateDoc.performedDate === 'string') {
      updateDoc.performedDate = new Date(updateDoc.performedDate);
    }
    if (updateDoc.nextMaintenanceDue && typeof updateDoc.nextMaintenanceDue === 'string') {
      updateDoc.nextMaintenanceDue = new Date(updateDoc.nextMaintenanceDue);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(historyId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as MaintenanceHistory | null;
  } catch {
    return null;
  }
}

export async function deleteMaintenanceHistory(
  historyId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getMaintenanceHistoryCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(historyId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}
