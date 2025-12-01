import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findTenantById } from '@/lib/tenants/tenants';

const PARKING_SPACES_COLLECTION_NAME = 'parkingSpaces';

export type ParkingSpaceType = 'tenant' | 'visitor' | 'reserved';
export type ParkingSpaceStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface ParkingSpace {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  spaceNumber: string; // e.g., "P-001"
  spaceType: ParkingSpaceType;
  status: ParkingSpaceStatus;
  assignedTo?: string | null; // ObjectId ref to tenants (for tenant spaces)
  vehicleId?: string | null; // ObjectId ref to vehicles (if occupied)
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getParkingSpacesCollection(): Promise<Collection<ParkingSpace>> {
  const db = await getDb();
  return db.collection<ParkingSpace>(PARKING_SPACES_COLLECTION_NAME);
}

export async function ensureParkingSpaceIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PARKING_SPACES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound unique index on buildingId and spaceNumber
    {
      key: { buildingId: 1, spaceNumber: 1 },
      unique: true,
      name: 'unique_building_space_number',
    },
    // Compound index on organizationId, buildingId, and status
    {
      key: { organizationId: 1, buildingId: 1, status: 1 },
      name: 'org_building_status',
    },
    // Sparse index on assignedTo
    {
      key: { assignedTo: 1 },
      sparse: true,
      name: 'assignedTo_sparse',
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
 * Validates that a tenant exists and belongs to the same organization (if provided).
 */
async function validateTenantBelongsToOrg(
  tenantId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!tenantId) {
    return; // Tenant is optional
  }

  const tenant = await findTenantById(tenantId, organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  if (tenant.organizationId !== organizationId) {
    throw new Error('Tenant does not belong to the same organization');
  }
}

export interface CreateParkingSpaceInput {
  organizationId: string;
  buildingId: string;
  spaceNumber: string;
  spaceType: ParkingSpaceType;
  status?: ParkingSpaceStatus;
  assignedTo?: string | null;
  vehicleId?: string | null;
  notes?: string | null;
}

export async function createParkingSpace(input: CreateParkingSpaceInput): Promise<ParkingSpace> {
  const collection = await getParkingSpacesCollection();
  const now = new Date();

  // Validate building exists and belongs to same org
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate tenant if provided
  await validateTenantBelongsToOrg(input.assignedTo, input.organizationId);

  // Validate required fields
  if (!input.spaceNumber || !input.spaceType) {
    throw new Error('spaceNumber and spaceType are required');
  }

  // Validate space number uniqueness (will be enforced by unique index, but check early for better error)
  const existingSpace = await collection.findOne({
    buildingId: input.buildingId,
    spaceNumber: input.spaceNumber.trim(),
  } as Document);

  if (existingSpace) {
    throw new Error('Parking space number already exists in this building');
  }

  const doc: Omit<ParkingSpace, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    spaceNumber: input.spaceNumber.trim(),
    spaceType: input.spaceType,
    status: input.status ?? 'available',
    assignedTo: input.assignedTo ?? null,
    vehicleId: input.vehicleId ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<ParkingSpace>);

  return {
    ...(doc as ParkingSpace),
    _id: result.insertedId.toString(),
  } as ParkingSpace;
}

export async function findParkingSpaceById(
  parkingSpaceId: string,
  organizationId?: string,
): Promise<ParkingSpace | null> {
  const collection = await getParkingSpacesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(parkingSpaceId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findParkingSpacesByBuilding(
  buildingId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<ParkingSpace[]> {
  const collection = await getParkingSpacesCollection();

  const query: Record<string, unknown> = {
    buildingId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ spaceNumber: 1 })
    .toArray();
}

export async function updateParkingSpace(
  parkingSpaceId: string,
  updates: Partial<ParkingSpace>,
): Promise<ParkingSpace | null> {
  const collection = await getParkingSpacesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingSpace = await findParkingSpaceById(parkingSpaceId);
    if (!existingSpace) {
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
    if (updateDoc.spaceNumber && typeof updateDoc.spaceNumber === 'string') {
      updateDoc.spaceNumber = updateDoc.spaceNumber.trim();
    }

    // Validate building if being updated
    if (updateDoc.buildingId !== undefined && updateDoc.buildingId !== existingSpace.buildingId) {
      await validateBuildingBelongsToOrg(
        updateDoc.buildingId as string,
        existingSpace.organizationId,
      );
    }

    // Validate tenant if being updated
    if (updateDoc.assignedTo !== undefined && updateDoc.assignedTo !== existingSpace.assignedTo) {
      await validateTenantBelongsToOrg(
        updateDoc.assignedTo as string | null,
        existingSpace.organizationId,
      );
    }

    // Validate space number uniqueness if being updated
    if (
      updateDoc.spaceNumber !== undefined &&
      updateDoc.spaceNumber !== existingSpace.spaceNumber
    ) {
      const existingSpaceWithNumber = await collection.findOne({
        buildingId: existingSpace.buildingId,
        spaceNumber: updateDoc.spaceNumber as string,
        _id: { $ne: new ObjectId(parkingSpaceId) },
      } as Document);

      if (existingSpaceWithNumber) {
        throw new Error('Parking space number already exists in this building');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(parkingSpaceId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as ParkingSpace | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteParkingSpace(parkingSpaceId: string): Promise<boolean> {
  const collection = await getParkingSpacesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const result = await collection.deleteOne({ _id: new ObjectId(parkingSpaceId) } as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}

export async function listParkingSpaces(
  query: Record<string, unknown> = {},
): Promise<ParkingSpace[]> {
  const collection = await getParkingSpacesCollection();

  return collection
    .find(query as Document)
    .sort({ spaceNumber: 1 })
    .toArray();
}
