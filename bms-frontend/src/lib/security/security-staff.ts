import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findUserById } from '@/lib/auth/users';
import { findBuildingById } from '@/lib/buildings/buildings';

const SECURITY_STAFF_COLLECTION_NAME = 'securityStaff';

export interface SecurityStaff {
  _id: string;
  userId: string; // ObjectId ref to users
  organizationId: string;
  buildingId?: string | null; // Primary building assignment
  assignedBuildings?: string[]; // Multiple building assignments
  employeeId?: string | null;
  badgeNumber?: string | null;
  hireDate?: Date | null;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship?: string;
  } | null;
  certifications?: Array<{
    name: string;
    issuedDate: Date;
    expiryDate?: Date | null;
    issuer?: string | null;
  }> | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSecurityStaffCollection(): Promise<Collection<SecurityStaff>> {
  const db = await getDb();
  return db.collection<SecurityStaff>(SECURITY_STAFF_COLLECTION_NAME);
}

export async function ensureSecurityStaffIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(SECURITY_STAFF_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Unique userId per organization
    {
      key: { organizationId: 1, userId: 1 },
      unique: true,
      name: 'unique_org_user',
    },
    // Index on organizationId
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
    // Index on buildingId
    {
      key: { buildingId: 1 },
      sparse: true,
      name: 'buildingId_sparse',
    },
    // Index on assignedBuildings
    {
      key: { assignedBuildings: 1 },
      name: 'assignedBuildings',
    },
    // Index on employeeId (sparse, since it's optional)
    {
      key: { employeeId: 1 },
      sparse: true,
      name: 'employeeId_sparse',
    },
    // Index on badgeNumber (sparse, since it's optional)
    {
      key: { badgeNumber: 1 },
      sparse: true,
      name: 'badgeNumber_sparse',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a user exists and belongs to the same organization.
 */
async function validateUserBelongsToOrg(userId: string, organizationId: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (user.organizationId !== organizationId) {
    throw new Error('User does not belong to the same organization');
  }
}

/**
 * Validates that a building exists and belongs to the same organization.
 */
async function validateBuildingBelongsToOrg(
  buildingId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!buildingId) {
    return; // Building is optional
  }

  const building = await findBuildingById(buildingId, organizationId);
  if (!building) {
    throw new Error('Building not found');
  }
  if (building.organizationId !== organizationId) {
    throw new Error('Building does not belong to the same organization');
  }
}

export interface CreateSecurityStaffInput {
  organizationId: string;
  userId: string;
  buildingId?: string | null;
  assignedBuildings?: string[];
  employeeId?: string | null;
  badgeNumber?: string | null;
  hireDate?: Date | null;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship?: string;
  } | null;
  certifications?: Array<{
    name: string;
    issuedDate: Date;
    expiryDate?: Date | null;
    issuer?: string | null;
  }> | null;
  notes?: string | null;
}

export async function createSecurityStaff(input: CreateSecurityStaffInput): Promise<SecurityStaff> {
  const collection = await getSecurityStaffCollection();
  const now = new Date();

  // Validate user exists and belongs to same org
  await validateUserBelongsToOrg(input.userId, input.organizationId);

  // Validate primary building if provided
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate assigned buildings if provided
  if (input.assignedBuildings && input.assignedBuildings.length > 0) {
    for (const buildingId of input.assignedBuildings) {
      await validateBuildingBelongsToOrg(buildingId, input.organizationId);
    }
  }

  // Validate required fields
  if (!input.userId) {
    throw new Error('userId is required');
  }

  // Check if security staff profile already exists for this user
  const existing = await findSecurityStaffByUserId(input.userId, input.organizationId);
  if (existing) {
    throw new Error('Security staff profile already exists for this user');
  }

  const doc: Omit<SecurityStaff, '_id'> = {
    userId: input.userId,
    organizationId: input.organizationId,
    buildingId: input.buildingId ?? null,
    assignedBuildings: input.assignedBuildings ?? [],
    employeeId: input.employeeId?.trim() ?? null,
    badgeNumber: input.badgeNumber?.trim() ?? null,
    hireDate: input.hireDate ?? null,
    emergencyContact: input.emergencyContact ?? null,
    certifications: input.certifications ?? null,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<SecurityStaff>);

  return {
    ...(doc as SecurityStaff),
    _id: result.insertedId.toString(),
  } as SecurityStaff;
}

export async function findSecurityStaffById(
  securityStaffId: string,
  organizationId?: string,
): Promise<SecurityStaff | null> {
  const collection = await getSecurityStaffCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(securityStaffId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findSecurityStaffByUserId(
  userId: string,
  organizationId?: string,
): Promise<SecurityStaff | null> {
  const collection = await getSecurityStaffCollection();

  const query: Record<string, unknown> = { userId };
  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

export async function findSecurityStaffByBuilding(
  buildingId: string,
  organizationId?: string,
): Promise<SecurityStaff[]> {
  const collection = await getSecurityStaffCollection();

  const query: Record<string, unknown> = {
    $or: [{ buildingId }, { assignedBuildings: buildingId }],
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.find(query as Document).toArray();
}

export async function listSecurityStaff(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<SecurityStaff[]> {
  const collection = await getSecurityStaffCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function updateSecurityStaff(
  securityStaffId: string,
  updates: Partial<CreateSecurityStaffInput>,
  organizationId?: string,
): Promise<SecurityStaff | null> {
  const collection = await getSecurityStaffCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findSecurityStaffById(securityStaffId, organizationId);
    if (!existing) {
      return null;
    }

    // Validate user if being updated
    if (updates.userId !== undefined && updates.userId !== existing.userId) {
      await validateUserBelongsToOrg(updates.userId, existing.organizationId);
    }

    // Validate primary building if being updated
    if (updates.buildingId !== undefined && updates.buildingId !== existing.buildingId) {
      await validateBuildingBelongsToOrg(updates.buildingId, existing.organizationId);
    }

    // Validate assigned buildings if being updated
    if (updates.assignedBuildings !== undefined) {
      for (const buildingId of updates.assignedBuildings) {
        await validateBuildingBelongsToOrg(buildingId, existing.organizationId);
      }
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated directly
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // Trim string fields if present
    if (updateDoc.employeeId && typeof updateDoc.employeeId === 'string') {
      updateDoc.employeeId = updateDoc.employeeId.trim();
    }
    if (updateDoc.badgeNumber && typeof updateDoc.badgeNumber === 'string') {
      updateDoc.badgeNumber = updateDoc.badgeNumber.trim();
    }
    if (updateDoc.notes && typeof updateDoc.notes === 'string') {
      updateDoc.notes = updateDoc.notes.trim();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(securityStaffId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as SecurityStaff | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteSecurityStaff(
  securityStaffId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getSecurityStaffCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(securityStaffId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}

