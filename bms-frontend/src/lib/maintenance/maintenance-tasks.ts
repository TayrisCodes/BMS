import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findAssetById } from '@/lib/assets/assets';

const MAINTENANCE_TASKS_COLLECTION_NAME = 'maintenanceTasks';

export type ScheduleType = 'time-based' | 'usage-based';
export type FrequencyUnit = 'days' | 'weeks' | 'months' | 'hours' | 'usage_cycles';
export type MaintenanceTaskStatus = 'pending' | 'due' | 'overdue' | 'completed' | 'cancelled';

export interface MaintenanceTask {
  _id: string;
  organizationId: string;
  assetId: string;
  buildingId: string;
  taskName: string;
  description: string;
  scheduleType: ScheduleType;
  frequency?: {
    interval: number; // e.g., 30 days, 12 months
    unit: FrequencyUnit;
  } | null;
  usageThreshold?: number | null; // For usage-based schedules
  estimatedDuration?: number | null; // minutes
  estimatedCost?: number | null;
  assignedTo?: string | null; // ObjectId ref to users (default technician)
  lastPerformed?: Date | null;
  nextDueDate: Date;
  status: MaintenanceTaskStatus;
  autoGenerateWorkOrder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getMaintenanceTasksCollection(): Promise<Collection<MaintenanceTask>> {
  const db = await getDb();
  return db.collection<MaintenanceTask>(MAINTENANCE_TASKS_COLLECTION_NAME);
}

export async function ensureMaintenanceTaskIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(MAINTENANCE_TASKS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId and status
    {
      key: { organizationId: 1, status: 1 },
      name: 'org_status',
    },
    // Compound index on organizationId and nextDueDate
    {
      key: { organizationId: 1, nextDueDate: 1 },
      name: 'org_nextDueDate',
    },
    // Index on assetId
    {
      key: { assetId: 1 },
      name: 'assetId',
    },
    // Index on buildingId
    {
      key: { buildingId: 1 },
      name: 'buildingId',
    },
    // Index on assignedTo
    {
      key: { assignedTo: 1 },
      sparse: true,
      name: 'assignedTo_sparse',
    },
    // Index on status
    {
      key: { status: 1 },
      name: 'status',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a building exists and belongs to the same organization.
 */
async function validateBuildingBelongsToOrg(
  buildingId: string,
  organizationId: string,
): Promise<void> {
  const building = await findBuildingById(buildingId, organizationId);
  if (!building) {
    throw new Error('Building not found');
  }
  if (building.organizationId !== organizationId) {
    throw new Error('Building does not belong to the same organization');
  }
}

/**
 * Validates that an asset exists and belongs to the same organization.
 */
async function validateAssetBelongsToOrg(assetId: string, organizationId: string): Promise<void> {
  const asset = await findAssetById(assetId, organizationId);
  if (!asset) {
    throw new Error('Asset not found');
  }
  if (asset.organizationId !== organizationId) {
    throw new Error('Asset does not belong to the same organization');
  }
}

export interface CreateMaintenanceTaskInput {
  organizationId: string;
  assetId: string;
  buildingId: string;
  taskName: string;
  description: string;
  scheduleType: ScheduleType;
  frequency?: {
    interval: number;
    unit: FrequencyUnit;
  } | null;
  usageThreshold?: number | null;
  estimatedDuration?: number | null;
  estimatedCost?: number | null;
  assignedTo?: string | null;
  lastPerformed?: Date | string | null;
  nextDueDate: Date | string;
  autoGenerateWorkOrder?: boolean;
}

export async function createMaintenanceTask(
  input: CreateMaintenanceTaskInput,
): Promise<MaintenanceTask> {
  const collection = await getMaintenanceTasksCollection();
  const now = new Date();

  // Validate building and asset
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);
  await validateAssetBelongsToOrg(input.assetId, input.organizationId);

  // Validate required fields
  if (!input.taskName || !input.description || !input.scheduleType) {
    throw new Error('taskName, description, and scheduleType are required');
  }

  // Validate schedule type and frequency
  if (input.scheduleType === 'time-based' && !input.frequency) {
    throw new Error('frequency is required for time-based schedules');
  }
  if (input.scheduleType === 'usage-based' && !input.usageThreshold) {
    throw new Error('usageThreshold is required for usage-based schedules');
  }

  // Convert dates
  const nextDueDate =
    typeof input.nextDueDate === 'string' ? new Date(input.nextDueDate) : input.nextDueDate;
  const lastPerformed =
    input.lastPerformed && typeof input.lastPerformed === 'string'
      ? new Date(input.lastPerformed)
      : input.lastPerformed || null;

  // Determine initial status based on due date
  let status: MaintenanceTaskStatus = 'pending';
  if (nextDueDate <= now) {
    status = 'overdue';
  } else {
    const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 7) {
      status = 'due';
    }
  }

  const doc: Omit<MaintenanceTask, '_id'> = {
    organizationId: input.organizationId,
    assetId: input.assetId,
    buildingId: input.buildingId,
    taskName: input.taskName.trim(),
    description: input.description.trim(),
    scheduleType: input.scheduleType,
    frequency: input.frequency ?? null,
    usageThreshold: input.usageThreshold ?? null,
    estimatedDuration: input.estimatedDuration ?? null,
    estimatedCost: input.estimatedCost ?? null,
    assignedTo: input.assignedTo ?? null,
    lastPerformed,
    nextDueDate,
    status,
    autoGenerateWorkOrder: input.autoGenerateWorkOrder ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<MaintenanceTask>);

  return {
    ...(doc as MaintenanceTask),
    _id: result.insertedId.toString(),
  } as MaintenanceTask;
}

export async function findMaintenanceTaskById(
  taskId: string,
  organizationId?: string,
): Promise<MaintenanceTask | null> {
  const collection = await getMaintenanceTasksCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(taskId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findMaintenanceTasksByAsset(
  assetId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<MaintenanceTask[]> {
  const collection = await getMaintenanceTasksCollection();

  const query: Record<string, unknown> = {
    assetId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ nextDueDate: 1 })
    .toArray();
}

export async function findMaintenanceTasksByStatus(
  status: MaintenanceTaskStatus,
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<MaintenanceTask[]> {
  const collection = await getMaintenanceTasksCollection();

  const query: Record<string, unknown> = {
    organizationId,
    status,
    ...filters,
  };

  return collection
    .find(query as Document)
    .sort({ nextDueDate: 1 })
    .toArray();
}

export async function findDueMaintenanceTasks(
  organizationId: string,
  includeOverdue: boolean = true,
): Promise<MaintenanceTask[]> {
  const collection = await getMaintenanceTasksCollection();
  const now = new Date();

  const statusFilter: MaintenanceTaskStatus[] = ['due'];
  if (includeOverdue) {
    statusFilter.push('overdue');
  }

  return collection
    .find({
      organizationId,
      status: { $in: statusFilter },
      nextDueDate: { $lte: now },
    } as Document)
    .sort({ nextDueDate: 1 })
    .toArray();
}

export async function updateMaintenanceTask(
  taskId: string,
  updates: Partial<MaintenanceTask>,
  organizationId?: string,
): Promise<MaintenanceTask | null> {
  const collection = await getMaintenanceTasksCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingTask = await findMaintenanceTaskById(taskId, organizationId);
    if (!existingTask) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;

    // Trim string fields if present
    if (updateDoc.taskName && typeof updateDoc.taskName === 'string') {
      updateDoc.taskName = updateDoc.taskName.trim();
    }
    if (updateDoc.description && typeof updateDoc.description === 'string') {
      updateDoc.description = updateDoc.description.trim();
    }

    // Convert date strings to Date objects
    if (updateDoc.nextDueDate && typeof updateDoc.nextDueDate === 'string') {
      updateDoc.nextDueDate = new Date(updateDoc.nextDueDate);
    }
    if (updateDoc.lastPerformed && typeof updateDoc.lastPerformed === 'string') {
      updateDoc.lastPerformed = new Date(updateDoc.lastPerformed);
    }

    // Validate building if being updated
    if (updateDoc.buildingId !== undefined && updateDoc.buildingId !== existingTask.buildingId) {
      await validateBuildingBelongsToOrg(
        updateDoc.buildingId as string,
        existingTask.organizationId,
      );
    }

    // Validate asset if being updated
    if (updateDoc.assetId !== undefined && updateDoc.assetId !== existingTask.assetId) {
      await validateAssetBelongsToOrg(updateDoc.assetId as string, existingTask.organizationId);
    }

    // Recalculate status if nextDueDate is updated
    if (updateDoc.nextDueDate) {
      const nextDueDate =
        updateDoc.nextDueDate instanceof Date
          ? updateDoc.nextDueDate
          : new Date(updateDoc.nextDueDate as string);
      const now = new Date();

      if (nextDueDate <= now) {
        updateDoc.status = 'overdue';
      } else {
        const daysUntilDue = Math.ceil(
          (nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysUntilDue <= 7) {
          updateDoc.status = 'due';
        } else {
          updateDoc.status = 'pending';
        }
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(taskId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as MaintenanceTask | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function completeMaintenanceTask(
  taskId: string,
  organizationId?: string,
): Promise<MaintenanceTask | null> {
  const collection = await getMaintenanceTasksCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingTask = await findMaintenanceTaskById(taskId, organizationId);
    if (!existingTask) {
      return null;
    }

    const now = new Date();
    const updateDoc: Record<string, unknown> = {
      status: 'completed',
      lastPerformed: now,
      updatedAt: now,
    };

    // Calculate next due date based on frequency
    if (existingTask.frequency && existingTask.scheduleType === 'time-based') {
      const { interval, unit } = existingTask.frequency;
      const nextDueDate = new Date(now);

      switch (unit) {
        case 'days':
          nextDueDate.setDate(nextDueDate.getDate() + interval);
          break;
        case 'weeks':
          nextDueDate.setDate(nextDueDate.getDate() + interval * 7);
          break;
        case 'months':
          nextDueDate.setMonth(nextDueDate.getMonth() + interval);
          break;
        case 'hours':
          nextDueDate.setHours(nextDueDate.getHours() + interval);
          break;
        default:
          // For usage_cycles, we'd need to track usage - for now, keep same date
          break;
      }

      updateDoc.nextDueDate = nextDueDate;
      updateDoc.status = 'pending'; // Reset to pending for next cycle
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(taskId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as MaintenanceTask | null;
  } catch {
    return null;
  }
}

export async function listMaintenanceTasks(
  query: Record<string, unknown> = {},
): Promise<MaintenanceTask[]> {
  const collection = await getMaintenanceTasksCollection();

  return collection
    .find(query as Document)
    .sort({ nextDueDate: 1 })
    .toArray();
}

