import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUnitById } from '@/lib/units/units';
import { findParkingSpaceById } from '@/lib/parking/parking-spaces';

const VISITOR_LOGS_COLLECTION_NAME = 'visitorLogs';

export interface VisitorLog {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null; // Ethiopian ID
  hostTenantId: string; // ObjectId ref to tenants
  hostUnitId?: string | null; // ObjectId ref to units
  purpose: string; // Visit purpose
  vehiclePlateNumber?: string | null;
  parkingSpaceId?: string | null; // ObjectId ref to parking spaces
  entryTime: Date;
  exitTime?: Date | null;
  loggedBy: string; // ObjectId ref to users (guard/security)
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getVisitorLogsCollection(): Promise<Collection<VisitorLog>> {
  const db = await getDb();
  return db.collection<VisitorLog>(VISITOR_LOGS_COLLECTION_NAME);
}

export async function ensureVisitorLogIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(VISITOR_LOGS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and entryTime (descending for latest)
    {
      key: { organizationId: 1, buildingId: 1, entryTime: -1 },
      name: 'org_building_entry_time',
    },
    // Index on hostTenantId
    {
      key: { hostTenantId: 1 },
      name: 'hostTenantId',
    },
    // Index on entryTime
    {
      key: { entryTime: 1 },
      name: 'entryTime',
    },
    // Index on exitTime (sparse, since exitTime can be null)
    {
      key: { exitTime: 1 },
      sparse: true,
      name: 'exitTime_sparse',
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
 * Validates that a tenant exists and belongs to the same organization.
 */
async function validateTenantBelongsToOrg(tenantId: string, organizationId: string): Promise<void> {
  const tenant = await findTenantById(tenantId, organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  if (tenant.organizationId !== organizationId) {
    throw new Error('Tenant does not belong to the same organization');
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

/**
 * Validates that a parking space exists and belongs to the same organization (if provided).
 */
async function validateParkingSpaceBelongsToOrg(
  parkingSpaceId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!parkingSpaceId) {
    return; // Parking space is optional
  }

  const parkingSpace = await findParkingSpaceById(parkingSpaceId, organizationId);
  if (!parkingSpace) {
    throw new Error('Parking space not found');
  }
  if (parkingSpace.organizationId !== organizationId) {
    throw new Error('Parking space does not belong to the same organization');
  }
}

export interface CreateVisitorLogInput {
  organizationId: string;
  buildingId: string;
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  hostTenantId: string;
  hostUnitId?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  parkingSpaceId?: string | null;
  entryTime?: Date;
  loggedBy: string;
  notes?: string | null;
}

export async function createVisitorLog(input: CreateVisitorLogInput): Promise<VisitorLog> {
  const collection = await getVisitorLogsCollection();
  const now = new Date();

  // Validate building exists and belongs to same org
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate tenant exists and belongs to same org
  await validateTenantBelongsToOrg(input.hostTenantId, input.organizationId);

  // Validate unit if provided
  await validateUnitBelongsToOrg(input.hostUnitId, input.organizationId);

  // Validate parking space if provided
  await validateParkingSpaceBelongsToOrg(input.parkingSpaceId, input.organizationId);

  // Validate required fields
  if (!input.visitorName || !input.hostTenantId || !input.purpose || !input.loggedBy) {
    throw new Error('visitorName, hostTenantId, purpose, and loggedBy are required');
  }

  const doc: Omit<VisitorLog, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    visitorName: input.visitorName.trim(),
    visitorPhone: input.visitorPhone?.trim() ?? null,
    visitorIdNumber: input.visitorIdNumber?.trim() ?? null,
    hostTenantId: input.hostTenantId,
    hostUnitId: input.hostUnitId ?? null,
    purpose: input.purpose.trim(),
    vehiclePlateNumber: input.vehiclePlateNumber?.trim().toUpperCase() ?? null,
    parkingSpaceId: input.parkingSpaceId ?? null,
    entryTime: input.entryTime ?? now,
    exitTime: null,
    loggedBy: input.loggedBy,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<VisitorLog>);

  return {
    ...(doc as VisitorLog),
    _id: result.insertedId.toString(),
  } as VisitorLog;
}

export async function findVisitorLogById(
  visitorLogId: string,
  organizationId?: string,
): Promise<VisitorLog | null> {
  const collection = await getVisitorLogsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(visitorLogId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findVisitorLogsByBuilding(
  buildingId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<VisitorLog[]> {
  const collection = await getVisitorLogsCollection();

  const query: Record<string, unknown> = {
    buildingId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ entryTime: -1 })
    .toArray();
}

export async function findVisitorLogsByTenant(
  tenantId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<VisitorLog[]> {
  const collection = await getVisitorLogsCollection();

  const query: Record<string, unknown> = {
    hostTenantId: tenantId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ entryTime: -1 })
    .toArray();
}

export async function findActiveVisitorLogs(
  buildingId?: string,
  organizationId?: string,
): Promise<VisitorLog[]> {
  const collection = await getVisitorLogsCollection();

  const query: Record<string, unknown> = {
    exitTime: null, // Active visitors have no exit time
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }
  if (buildingId) {
    query.buildingId = buildingId;
  }

  return collection
    .find(query as Document)
    .sort({ entryTime: -1 })
    .toArray();
}

export async function updateVisitorLogExit(
  visitorLogId: string,
  exitTime: Date,
): Promise<VisitorLog | null> {
  const collection = await getVisitorLogsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingLog = await findVisitorLogById(visitorLogId);
    if (!existingLog) {
      return null;
    }

    // Validate exit time is after entry time
    if (exitTime < existingLog.entryTime) {
      throw new Error('Exit time cannot be before entry time');
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(visitorLogId) } as Document,
      {
        $set: {
          exitTime,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as VisitorLog | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function updateVisitorLog(
  visitorLogId: string,
  updates: Partial<VisitorLog>,
): Promise<VisitorLog | null> {
  const collection = await getVisitorLogsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingLog = await findVisitorLogById(visitorLogId);
    if (!existingLog) {
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
    if (updateDoc.visitorName && typeof updateDoc.visitorName === 'string') {
      updateDoc.visitorName = updateDoc.visitorName.trim();
    }
    if (updateDoc.visitorPhone && typeof updateDoc.visitorPhone === 'string') {
      updateDoc.visitorPhone = updateDoc.visitorPhone.trim();
    }
    if (updateDoc.purpose && typeof updateDoc.purpose === 'string') {
      updateDoc.purpose = updateDoc.purpose.trim();
    }
    if (updateDoc.vehiclePlateNumber && typeof updateDoc.vehiclePlateNumber === 'string') {
      updateDoc.vehiclePlateNumber = updateDoc.vehiclePlateNumber.trim().toUpperCase();
    }

    // Validate building if being updated
    if (updateDoc.buildingId !== undefined && updateDoc.buildingId !== existingLog.buildingId) {
      await validateBuildingBelongsToOrg(
        updateDoc.buildingId as string,
        existingLog.organizationId,
      );
    }

    // Validate tenant if being updated
    if (
      updateDoc.hostTenantId !== undefined &&
      updateDoc.hostTenantId !== existingLog.hostTenantId
    ) {
      await validateTenantBelongsToOrg(
        updateDoc.hostTenantId as string,
        existingLog.organizationId,
      );
    }

    // Validate unit if being updated
    if (updateDoc.hostUnitId !== undefined && updateDoc.hostUnitId !== existingLog.hostUnitId) {
      await validateUnitBelongsToOrg(
        updateDoc.hostUnitId as string | null,
        existingLog.organizationId,
      );
    }

    // Validate parking space if being updated
    if (
      updateDoc.parkingSpaceId !== undefined &&
      updateDoc.parkingSpaceId !== existingLog.parkingSpaceId
    ) {
      await validateParkingSpaceBelongsToOrg(
        updateDoc.parkingSpaceId as string | null,
        existingLog.organizationId,
      );
    }

    // Validate exit time is after entry time if being updated
    if (updateDoc.exitTime !== undefined) {
      const entryTime = updateDoc.entryTime || existingLog.entryTime;
      if (updateDoc.exitTime && entryTime && updateDoc.exitTime < entryTime) {
        throw new Error('Exit time cannot be before entry time');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(visitorLogId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as VisitorLog | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listVisitorLogs(query: Record<string, unknown> = {}): Promise<VisitorLog[]> {
  const collection = await getVisitorLogsCollection();

  return collection
    .find(query as Document)
    .sort({ entryTime: -1 })
    .toArray();
}
