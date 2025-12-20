import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findTenantById } from '@/lib/tenants/tenants';
import { findParkingSpaceById } from './parking-spaces';

const VEHICLES_COLLECTION_NAME = 'vehicles';

export type VehicleStatus = 'active' | 'inactive';

export interface Vehicle {
  _id: string;
  organizationId: string;
  tenantId: string; // ObjectId ref to tenants
  plateNumber: string; // License plate
  make?: string | null; // e.g., "Toyota"
  model?: string | null; // e.g., "Corolla"
  color?: string | null;
  parkingSpaceId?: string | null; // ObjectId ref to parking spaces (current assignment)
  status: VehicleStatus;
  isTemporary?: boolean; // Flag for temporary visitor vehicles
  visitorLogId?: string | null; // ObjectId ref to visitor logs (for temporary vehicles)
  expiresAt?: Date | null; // Expiration date for temporary vehicles
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getVehiclesCollection(): Promise<Collection<Vehicle>> {
  const db = await getDb();
  return db.collection<Vehicle>(VEHICLES_COLLECTION_NAME);
}

export async function ensureVehicleIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(VEHICLES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound unique index on organizationId and plateNumber
    {
      key: { organizationId: 1, plateNumber: 1 },
      unique: true,
      name: 'unique_org_plate_number',
    },
    // Compound index on organizationId and tenantId
    {
      key: { organizationId: 1, tenantId: 1 },
      name: 'org_tenant',
    },
    // Sparse index on parkingSpaceId
    {
      key: { parkingSpaceId: 1 },
      sparse: true,
      name: 'parkingSpaceId_sparse',
    },
  ];

  await collection.createIndexes(indexes);
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

export interface CreateVehicleInput {
  organizationId: string;
  tenantId: string;
  plateNumber: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  parkingSpaceId?: string | null;
  status?: VehicleStatus;
  isTemporary?: boolean;
  visitorLogId?: string | null;
  expiresAt?: Date | null;
  notes?: string | null;
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const collection = await getVehiclesCollection();
  const now = new Date();

  // Validate tenant exists and belongs to same org
  await validateTenantBelongsToOrg(input.tenantId, input.organizationId);

  // Validate parking space if provided
  await validateParkingSpaceBelongsToOrg(input.parkingSpaceId, input.organizationId);

  // Validate required fields
  if (!input.plateNumber) {
    throw new Error('plateNumber is required');
  }

  // Validate plate number uniqueness (will be enforced by unique index, but check early for better error)
  const existingVehicle = await collection.findOne({
    organizationId: input.organizationId,
    plateNumber: input.plateNumber.trim().toUpperCase(),
  } as Document);

  if (existingVehicle) {
    throw new Error('Plate number already exists in this organization');
  }

  const doc: Omit<Vehicle, '_id'> = {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    plateNumber: input.plateNumber.trim().toUpperCase(),
    make: input.make ?? null,
    model: input.model ?? null,
    color: input.color ?? null,
    parkingSpaceId: input.parkingSpaceId ?? null,
    status: input.status ?? 'active',
    isTemporary: input.isTemporary ?? false,
    visitorLogId: input.visitorLogId ?? null,
    expiresAt: input.expiresAt ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Vehicle>);

  return {
    ...(doc as Vehicle),
    _id: result.insertedId.toString(),
  } as Vehicle;
}

export async function findVehicleById(
  vehicleId: string,
  organizationId?: string,
): Promise<Vehicle | null> {
  const collection = await getVehiclesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(vehicleId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findVehiclesByTenant(
  tenantId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<Vehicle[]> {
  const collection = await getVehiclesCollection();

  const query: Record<string, unknown> = {
    tenantId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ plateNumber: 1 })
    .toArray();
}

export async function findVehiclesByParkingSpace(
  parkingSpaceId: string,
  organizationId?: string,
): Promise<Vehicle[]> {
  const collection = await getVehiclesCollection();

  const query: Record<string, unknown> = {
    parkingSpaceId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ plateNumber: 1 })
    .toArray();
}

export async function updateVehicle(
  vehicleId: string,
  updates: Partial<Vehicle>,
): Promise<Vehicle | null> {
  const collection = await getVehiclesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingVehicle = await findVehicleById(vehicleId);
    if (!existingVehicle) {
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

    // Trim and uppercase plate number if being updated
    if (updateDoc.plateNumber && typeof updateDoc.plateNumber === 'string') {
      updateDoc.plateNumber = updateDoc.plateNumber.trim().toUpperCase();
    }

    // Validate tenant if being updated
    if (updateDoc.tenantId !== undefined && updateDoc.tenantId !== existingVehicle.tenantId) {
      await validateTenantBelongsToOrg(
        updateDoc.tenantId as string,
        existingVehicle.organizationId,
      );
    }

    // Validate parking space if being updated
    if (
      updateDoc.parkingSpaceId !== undefined &&
      updateDoc.parkingSpaceId !== existingVehicle.parkingSpaceId
    ) {
      await validateParkingSpaceBelongsToOrg(
        updateDoc.parkingSpaceId as string | null,
        existingVehicle.organizationId,
      );
    }

    // Validate plate number uniqueness if being updated
    if (
      updateDoc.plateNumber !== undefined &&
      updateDoc.plateNumber !== existingVehicle.plateNumber
    ) {
      const existingVehicleWithPlate = await collection.findOne({
        organizationId: existingVehicle.organizationId,
        plateNumber: updateDoc.plateNumber as string,
        _id: { $ne: new ObjectId(vehicleId) },
      } as Document);

      if (existingVehicleWithPlate) {
        throw new Error('Plate number already exists in this organization');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(vehicleId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Vehicle | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteVehicle(vehicleId: string): Promise<boolean> {
  const collection = await getVehiclesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Soft delete: set status to inactive
    const result = await collection.updateOne(
      { _id: new ObjectId(vehicleId) } as Document,
      { $set: { status: 'inactive' as VehicleStatus, updatedAt: new Date() } } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listVehicles(query: Record<string, unknown> = {}): Promise<Vehicle[]> {
  const collection = await getVehiclesCollection();

  return collection
    .find(query as Document)
    .sort({ plateNumber: 1 })
    .toArray();
}
