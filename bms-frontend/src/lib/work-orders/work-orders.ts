import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';

const WORK_ORDERS_COLLECTION_NAME = 'workOrders';

export type WorkOrderCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'cleaning'
  | 'security'
  | 'other';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface WorkOrder {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  complaintId?: string | null; // ObjectId ref to complaints (optional)
  unitId?: string | null; // ObjectId ref to units (optional)
  assetId?: string | null; // ObjectId ref to assets (optional)
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTo?: string | null; // ObjectId ref to users (technician)
  estimatedCost?: number | null; // ETB
  actualCost?: number | null; // ETB
  scheduledDate?: Date | null; // When work is scheduled to be performed
  scheduledTimeWindow?: {
    start: Date;
    end: Date;
  } | null; // Time window for scheduled work
  startedAt?: Date | null; // When technician started work
  completedAt?: Date | null;
  notes?: string | null;
  photos?: string[] | null; // URLs
  createdBy: string; // ObjectId ref to users
  createdAt: Date;
  updatedAt: Date;
}

export async function getWorkOrdersCollection(): Promise<Collection<WorkOrder>> {
  const db = await getDb();
  return db.collection<WorkOrder>(WORK_ORDERS_COLLECTION_NAME);
}

export async function ensureWorkOrderIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(WORK_ORDERS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and status
    {
      key: { organizationId: 1, buildingId: 1, status: 1 },
      name: 'org_building_status',
    },
    // Compound index on organizationId, assignedTo, and status
    {
      key: { organizationId: 1, assignedTo: 1, status: 1 },
      name: 'org_assigned_status',
    },
    // Sparse index on complaintId
    {
      key: { complaintId: 1 },
      sparse: true,
      name: 'complaintId_sparse',
    },
    // Index on status
    {
      key: { status: 1 },
      name: 'status',
    },
    // Index on priority
    {
      key: { priority: 1 },
      name: 'priority',
    },
    // Index on scheduledDate for scheduling queries
    {
      key: { scheduledDate: 1 },
      sparse: true,
      name: 'scheduledDate_sparse',
    },
    // Index on assignedTo and scheduledDate for technician scheduling
    {
      key: { assignedTo: 1, scheduledDate: 1 },
      sparse: true,
      name: 'assigned_scheduled',
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
 * Validates that a unit exists and belongs to the same organization (if provided).
 */
async function validateUnitBelongsToOrg(
  unitId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!unitId) {
    return; // Unit is optional
  }

  const unit = await findUnitById(unitId, organizationId);
  if (!unit) {
    throw new Error('Unit not found');
  }
  if (unit.organizationId !== organizationId) {
    throw new Error('Unit does not belong to the same organization');
  }
}

export interface CreateWorkOrderInput {
  organizationId: string;
  buildingId: string;
  complaintId?: string | null | undefined;
  unitId?: string | null | undefined;
  assetId?: string | null | undefined;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority?: WorkOrderPriority | undefined;
  status?: WorkOrderStatus | undefined;
  assignedTo?: string | null | undefined;
  estimatedCost?: number | null | undefined;
  scheduledDate?: Date | string | null | undefined;
  scheduledTimeWindow?:
    | {
        start: Date | string;
        end: Date | string;
      }
    | null
    | undefined;
  createdBy: string;
}

export async function createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
  const collection = await getWorkOrdersCollection();
  const now = new Date();

  // Validate building exists and belongs to same org
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate unit if provided
  await validateUnitBelongsToOrg(input.unitId, input.organizationId);

  // Validate required fields
  if (!input.title || !input.description || !input.category) {
    throw new Error('title, description, and category are required');
  }

  // Convert date strings to Date objects
  const scheduledDate: Date | null =
    input.scheduledDate && typeof input.scheduledDate === 'string'
      ? new Date(input.scheduledDate)
      : input.scheduledDate instanceof Date
        ? input.scheduledDate
        : null;

  const scheduledTimeWindow = input.scheduledTimeWindow
    ? {
        start:
          typeof input.scheduledTimeWindow.start === 'string'
            ? new Date(input.scheduledTimeWindow.start)
            : input.scheduledTimeWindow.start,
        end:
          typeof input.scheduledTimeWindow.end === 'string'
            ? new Date(input.scheduledTimeWindow.end)
            : input.scheduledTimeWindow.end,
      }
    : null;

  const doc: Omit<WorkOrder, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    complaintId: input.complaintId ?? null,
    unitId: input.unitId ?? null,
    assetId: input.assetId ?? null,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority ?? 'medium',
    status: input.status ?? 'open',
    assignedTo: input.assignedTo ?? null,
    estimatedCost: input.estimatedCost ?? null,
    actualCost: null,
    scheduledDate,
    scheduledTimeWindow,
    startedAt: null,
    completedAt: null,
    notes: null,
    photos: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<WorkOrder>);

  return {
    ...(doc as WorkOrder),
    _id: result.insertedId.toString(),
  } as WorkOrder;
}

export async function findWorkOrderById(
  workOrderId: string,
  organizationId?: string,
): Promise<WorkOrder | null> {
  const collection = await getWorkOrdersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(workOrderId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findWorkOrdersByBuilding(
  buildingId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<WorkOrder[]> {
  const collection = await getWorkOrdersCollection();

  const query: Record<string, unknown> = {
    buildingId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function findWorkOrdersByTechnician(
  technicianId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<WorkOrder[]> {
  const collection = await getWorkOrdersCollection();

  const query: Record<string, unknown> = {
    assignedTo: technicianId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function updateWorkOrderStatus(
  workOrderId: string,
  status: WorkOrderStatus,
  assignedTo?: string | null,
): Promise<WorkOrder | null> {
  const collection = await getWorkOrdersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingWorkOrder = await findWorkOrderById(workOrderId);
    if (!existingWorkOrder) {
      return null;
    }

    const now = new Date();
    const updateDoc: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    // If assignedTo is provided, update it
    if (assignedTo !== undefined) {
      updateDoc.assignedTo = assignedTo ?? null;
      // If assigning to someone and status is "open", set status to "assigned"
      if (assignedTo && existingWorkOrder.status === 'open') {
        updateDoc.status = 'assigned';
      }
    }

    // If status is being changed to completed, set completedAt
    if (status === 'completed') {
      if (!existingWorkOrder.completedAt) {
        updateDoc.completedAt = now;
      }
    } else {
      // If status is being changed from completed back to something else, clear completedAt
      if (existingWorkOrder.status === 'completed') {
        updateDoc.completedAt = null;
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(workOrderId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as WorkOrder | null;
  } catch {
    return null;
  }
}

export async function completeWorkOrder(
  workOrderId: string,
  actualCost?: number | null,
  notes?: string | null,
  photos?: string[] | null,
): Promise<WorkOrder | null> {
  const collection = await getWorkOrdersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingWorkOrder = await findWorkOrderById(workOrderId);
    if (!existingWorkOrder) {
      return null;
    }

    const now = new Date();
    const updateDoc: Record<string, unknown> = {
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };

    if (actualCost !== undefined) {
      updateDoc.actualCost = actualCost ?? null;
    }

    if (notes !== undefined) {
      updateDoc.notes = notes ?? null;
    }

    if (photos !== undefined) {
      updateDoc.photos = photos ?? null;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(workOrderId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as WorkOrder | null;
  } catch {
    return null;
  }
}

export async function updateWorkOrder(
  workOrderId: string,
  updates: Partial<WorkOrder>,
): Promise<WorkOrder | null> {
  const collection = await getWorkOrdersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingWorkOrder = await findWorkOrderById(workOrderId);
    if (!existingWorkOrder) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // Trim string fields if present
    if (updateDoc.title && typeof updateDoc.title === 'string') {
      updateDoc.title = updateDoc.title.trim();
    }
    if (updateDoc.description && typeof updateDoc.description === 'string') {
      updateDoc.description = updateDoc.description.trim();
    }
    if (updateDoc.notes && typeof updateDoc.notes === 'string') {
      updateDoc.notes = updateDoc.notes.trim();
    }

    // Validate building if being updated
    if (
      updateDoc.buildingId !== undefined &&
      updateDoc.buildingId !== existingWorkOrder.buildingId
    ) {
      await validateBuildingBelongsToOrg(
        updateDoc.buildingId as string,
        existingWorkOrder.organizationId,
      );
    }

    // Validate unit if being updated
    if (updateDoc.unitId !== undefined && updateDoc.unitId !== existingWorkOrder.unitId) {
      await validateUnitBelongsToOrg(
        updateDoc.unitId as string | null,
        existingWorkOrder.organizationId,
      );
    }

    // Handle status changes
    if (updates.status) {
      const now = new Date();
      // If status is being changed to completed, set completedAt
      if (updates.status === 'completed') {
        if (!existingWorkOrder.completedAt) {
          updateDoc.completedAt = now;
        }
      } else {
        // If status is being changed from completed back to something else, clear completedAt
        if (existingWorkOrder.status === 'completed') {
          updateDoc.completedAt = null;
        }
      }
    }

    // Handle assignedTo changes - if assigning to someone and status is "open", change to "assigned"
    if (updates.assignedTo !== undefined) {
      if (updates.assignedTo && (!updates.status || updates.status === 'open')) {
        updateDoc.status = 'assigned';
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(workOrderId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as WorkOrder | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listWorkOrders(query: Record<string, unknown> = {}): Promise<WorkOrder[]> {
  const collection = await getWorkOrdersCollection();

  return collection
    .find(query as Document)
    .sort({ priority: 1, createdAt: -1 })
    .toArray();
}
