import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUserById } from '@/lib/auth/users';
import { findVisitorLogById } from './visitor-logs';

const ACCESS_CONTROL_COLLECTION_NAME = 'accessPermissions';

export type EntityType = 'tenant' | 'visitor' | 'staff';
export type AccessLevel = 'full' | 'restricted' | 'denied';

export interface AccessPermission {
  _id: string;
  organizationId: string;
  buildingId: string;
  entityType: EntityType;
  entityId: string; // ObjectId ref to tenant, visitor log, or user
  accessLevel: AccessLevel;
  restrictions?: {
    timeWindows?: Array<{
      dayOfWeek: number; // 0-6 (Sunday-Saturday)
      startTime: string; // HH:mm format
      endTime: string;
    }> | null;
    areas?: string[] | null; // Specific areas/units allowed
    requiresEscort?: boolean | null;
  } | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  notes?: string | null;
  createdBy: string; // ObjectId ref to users
  createdAt: Date;
  updatedAt: Date;
}

export async function getAccessControlCollection(): Promise<Collection<AccessPermission>> {
  const db = await getDb();
  return db.collection<AccessPermission>(ACCESS_CONTROL_COLLECTION_NAME);
}

export async function ensureAccessControlIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(ACCESS_CONTROL_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, entityType, and entityId
    {
      key: { organizationId: 1, buildingId: 1, entityType: 1, entityId: 1 },
      unique: true,
      name: 'unique_org_building_entity',
    },
    // Index on organizationId
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
    // Index on buildingId
    {
      key: { buildingId: 1 },
      name: 'buildingId',
    },
    // Index on entityType and entityId
    {
      key: { entityType: 1, entityId: 1 },
      name: 'entity_lookup',
    },
    // Index on accessLevel
    {
      key: { accessLevel: 1 },
      name: 'accessLevel',
    },
    // Index on validFrom and validUntil for active permissions
    {
      key: { validFrom: 1, validUntil: 1 },
      name: 'validity_period',
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
 * Validates that an entity exists and belongs to the same organization.
 */
async function validateEntityBelongsToOrg(
  entityType: EntityType,
  entityId: string,
  organizationId: string,
): Promise<void> {
  switch (entityType) {
    case 'tenant': {
      const tenant = await findTenantById(entityId, organizationId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      if (tenant.organizationId !== organizationId) {
        throw new Error('Tenant does not belong to the same organization');
      }
      break;
    }
    case 'visitor': {
      const visitorLog = await findVisitorLogById(entityId, organizationId);
      if (!visitorLog) {
        throw new Error('Visitor log not found');
      }
      if (visitorLog.organizationId !== organizationId) {
        throw new Error('Visitor log does not belong to the same organization');
      }
      break;
    }
    case 'staff': {
      const user = await findUserById(entityId);
      if (!user) {
        throw new Error('User not found');
      }
      if (user.organizationId !== organizationId) {
        throw new Error('User does not belong to the same organization');
      }
      break;
    }
    default:
      throw new Error(`Invalid entity type: ${entityType}`);
  }
}

/**
 * Validates time window format (HH:mm).
 */
function validateTimeWindow(time: string): void {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm format.`);
  }
}

/**
 * Validates restrictions object.
 */
function validateRestrictions(restrictions: AccessPermission['restrictions']): void {
  if (!restrictions) {
    return;
  }

  if (restrictions.timeWindows) {
    for (const window of restrictions.timeWindows) {
      if (window.dayOfWeek < 0 || window.dayOfWeek > 6) {
        throw new Error('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
      }
      validateTimeWindow(window.startTime);
      validateTimeWindow(window.endTime);

      // Parse times to validate startTime < endTime
      const [startHour, startMin] = window.startTime.split(':').map(Number);
      const [endHour, endMin] = window.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        throw new Error('endTime must be after startTime');
      }
    }
  }
}

export interface CreateAccessPermissionInput {
  organizationId: string;
  buildingId: string;
  entityType: EntityType;
  entityId: string;
  accessLevel: AccessLevel;
  restrictions?: {
    timeWindows?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }> | null;
    areas?: string[] | null;
    requiresEscort?: boolean | null;
  } | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  notes?: string | null;
  createdBy: string;
}

export async function createAccessPermission(
  input: CreateAccessPermissionInput,
): Promise<AccessPermission> {
  const collection = await getAccessControlCollection();
  const now = new Date();

  // Validate building
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate entity
  await validateEntityBelongsToOrg(input.entityType, input.entityId, input.organizationId);

  // Validate restrictions
  validateRestrictions(input.restrictions);

  // Validate validity period
  if (input.validFrom && input.validUntil && input.validFrom >= input.validUntil) {
    throw new Error('validFrom must be before validUntil');
  }

  // Validate required fields
  if (!input.entityId || !input.createdBy) {
    throw new Error('entityId and createdBy are required');
  }

  // Check if permission already exists
  const existing = await findAccessPermissionByEntity(
    input.buildingId,
    input.entityType,
    input.entityId,
    input.organizationId,
  );
  if (existing) {
    throw new Error('Access permission already exists for this entity in this building');
  }

  const doc: Omit<AccessPermission, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    entityType: input.entityType,
    entityId: input.entityId,
    accessLevel: input.accessLevel,
    restrictions: input.restrictions ?? null,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    notes: input.notes?.trim() ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<AccessPermission>);

  return {
    ...(doc as AccessPermission),
    _id: result.insertedId.toString(),
  } as AccessPermission;
}

export async function findAccessPermissionById(
  permissionId: string,
  organizationId?: string,
): Promise<AccessPermission | null> {
  const collection = await getAccessControlCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(permissionId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findAccessPermissionByEntity(
  buildingId: string,
  entityType: EntityType,
  entityId: string,
  organizationId?: string,
): Promise<AccessPermission | null> {
  const collection = await getAccessControlCollection();

  const query: Record<string, unknown> = {
    buildingId,
    entityType,
    entityId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

export async function findAccessPermissionsByBuilding(
  buildingId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<AccessPermission[]> {
  const collection = await getAccessControlCollection();

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

export async function findAccessPermissionsByEntity(
  entityType: EntityType,
  entityId: string,
  organizationId?: string,
): Promise<AccessPermission[]> {
  const collection = await getAccessControlCollection();

  const query: Record<string, unknown> = {
    entityType,
    entityId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function listAccessPermissions(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<AccessPermission[]> {
  const collection = await getAccessControlCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Checks if an access permission is currently valid (within validity period).
 */
export function isAccessPermissionValid(permission: AccessPermission): boolean {
  const now = new Date();

  if (permission.validFrom && now < permission.validFrom) {
    return false;
  }

  if (permission.validUntil && now > permission.validUntil) {
    return false;
  }

  return true;
}

/**
 * Checks if access is allowed at a specific time and day.
 */
export function isAccessAllowedAtTime(
  permission: AccessPermission,
  dayOfWeek: number,
  time: string,
): boolean {
  if (permission.accessLevel === 'denied') {
    return false;
  }

  if (permission.accessLevel === 'full') {
    return true;
  }

  // For restricted access, check time windows
  if (permission.restrictions?.timeWindows) {
    for (const window of permission.restrictions.timeWindows) {
      if (window.dayOfWeek === dayOfWeek) {
        const [startHour, startMin] = window.startTime.split(':').map(Number);
        const [endHour, endMin] = window.endTime.split(':').map(Number);
        const [checkHour, checkMin] = time.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const checkMinutes = checkHour * 60 + checkMin;

        if (checkMinutes >= startMinutes && checkMinutes <= endMinutes) {
          return true;
        }
      }
    }
    return false; // No matching time window found
  }

  // If no time windows specified, allow access (restricted but no time restrictions)
  return true;
}

export async function updateAccessPermission(
  permissionId: string,
  updates: Partial<CreateAccessPermissionInput>,
  organizationId?: string,
): Promise<AccessPermission | null> {
  const collection = await getAccessControlCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findAccessPermissionById(permissionId, organizationId);
    if (!existing) {
      return null;
    }

    // Validate building if being updated
    if (updates.buildingId !== undefined && updates.buildingId !== existing.buildingId) {
      await validateBuildingBelongsToOrg(updates.buildingId, existing.organizationId);
    }

    // Validate entity if being updated
    if (
      (updates.entityType !== undefined || updates.entityId !== undefined) &&
      (updates.entityType !== existing.entityType || updates.entityId !== existing.entityId)
    ) {
      const entityType = updates.entityType ?? existing.entityType;
      const entityId = updates.entityId ?? existing.entityId;
      await validateEntityBelongsToOrg(entityType, entityId, existing.organizationId);
    }

    // Validate restrictions if being updated
    if (updates.restrictions !== undefined) {
      validateRestrictions(updates.restrictions);
    }

    // Validate validity period if being updated
    const validFrom = updates.validFrom ?? existing.validFrom;
    const validUntil = updates.validUntil ?? existing.validUntil;
    if (validFrom && validUntil && validFrom >= validUntil) {
      throw new Error('validFrom must be before validUntil');
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateDoc.organizationId;
    delete updateDoc.createdBy;
    delete updateDoc.createdAt;

    // Trim string fields if present
    if (updateDoc.notes && typeof updateDoc.notes === 'string') {
      updateDoc.notes = updateDoc.notes.trim();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(permissionId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as AccessPermission | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteAccessPermission(
  permissionId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getAccessControlCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(permissionId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}

