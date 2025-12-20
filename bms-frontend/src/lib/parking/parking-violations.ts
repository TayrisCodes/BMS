import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findParkingSpaceById } from './parking-spaces';
import { findVehicleById } from './vehicles';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUserById } from '@/lib/auth/users';
import { findBuildingById } from '@/lib/buildings/buildings';

const PARKING_VIOLATIONS_COLLECTION_NAME = 'parkingViolations';

export type ViolationType =
  | 'unauthorized_parking'
  | 'expired_permit'
  | 'wrong_space'
  | 'overtime_parking'
  | 'no_permit';

export type ViolationSeverity = 'warning' | 'fine' | 'tow';
export type ViolationStatus = 'reported' | 'resolved' | 'appealed';

export interface ParkingViolation {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  parkingSpaceId?: string | null; // ObjectId ref to parking spaces
  vehicleId?: string | null; // ObjectId ref to vehicles
  tenantId?: string | null; // ObjectId ref to tenants (if applicable)
  violationType: ViolationType;
  severity: ViolationSeverity;
  status: ViolationStatus;
  fineAmount?: number | null; // Fine amount in ETB
  reportedBy: string; // ObjectId ref to users (security staff)
  reportedAt: Date;
  resolvedBy?: string | null; // ObjectId ref to users
  resolvedAt?: Date | null;
  resolutionNotes?: string | null;
  photos?: string[] | null; // URLs or file paths
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getParkingViolationsCollection(): Promise<Collection<ParkingViolation>> {
  const db = await getDb();
  return db.collection<ParkingViolation>(PARKING_VIOLATIONS_COLLECTION_NAME);
}

export async function ensureParkingViolationIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PARKING_VIOLATIONS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and status
    {
      key: { organizationId: 1, buildingId: 1, status: 1 },
      name: 'org_building_status',
    },
    // Index on violationType
    {
      key: { violationType: 1 },
      name: 'violationType',
    },
    // Index on severity
    {
      key: { severity: 1 },
      name: 'severity',
    },
    // Index on reportedAt for date range queries
    {
      key: { reportedAt: -1 },
      name: 'reportedAt',
    },
    // Sparse index on vehicleId
    {
      key: { vehicleId: 1 },
      sparse: true,
      name: 'vehicleId_sparse',
    },
    // Sparse index on tenantId
    {
      key: { tenantId: 1 },
      sparse: true,
      name: 'tenantId_sparse',
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
 * Validates that a parking space exists and belongs to the same organization (if provided).
 */
async function validateParkingSpaceBelongsToOrg(
  parkingSpaceId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!parkingSpaceId) {
    return;
  }

  const parkingSpace = await findParkingSpaceById(parkingSpaceId, organizationId);
  if (!parkingSpace) {
    throw new Error('Parking space not found');
  }
  if (parkingSpace.organizationId !== organizationId) {
    throw new Error('Parking space does not belong to the same organization');
  }
}

/**
 * Validates that a vehicle exists and belongs to the same organization (if provided).
 */
async function validateVehicleBelongsToOrg(
  vehicleId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!vehicleId) {
    return;
  }

  const vehicle = await findVehicleById(vehicleId, organizationId);
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }
  if (vehicle.organizationId !== organizationId) {
    throw new Error('Vehicle does not belong to the same organization');
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
    return;
  }

  const tenant = await findTenantById(tenantId, organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  if (tenant.organizationId !== organizationId) {
    throw new Error('Tenant does not belong to the same organization');
  }
}

export interface CreateParkingViolationInput {
  organizationId: string;
  buildingId: string;
  parkingSpaceId?: string | null;
  vehicleId?: string | null;
  tenantId?: string | null;
  violationType: ViolationType;
  severity: ViolationSeverity;
  fineAmount?: number | null;
  reportedBy: string;
  photos?: string[] | null;
  notes?: string | null;
}

export async function createParkingViolation(
  input: CreateParkingViolationInput,
): Promise<ParkingViolation> {
  const collection = await getParkingViolationsCollection();
  const now = new Date();

  // Validate building exists and belongs to same org
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate parking space if provided
  await validateParkingSpaceBelongsToOrg(input.parkingSpaceId, input.organizationId);

  // Validate vehicle if provided
  await validateVehicleBelongsToOrg(input.vehicleId, input.organizationId);

  // Validate tenant if provided
  await validateTenantBelongsToOrg(input.tenantId, input.organizationId);

  // Validate reportedBy user
  const reportedByUser = await findUserById(input.reportedBy);
  if (!reportedByUser || reportedByUser.organizationId !== input.organizationId) {
    throw new Error('Reporter user not found or does not belong to the organization');
  }

  // Validate required fields
  if (!input.violationType || !input.severity) {
    throw new Error('violationType and severity are required');
  }

  const doc: Omit<ParkingViolation, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    parkingSpaceId: input.parkingSpaceId ?? null,
    vehicleId: input.vehicleId ?? null,
    tenantId: input.tenantId ?? null,
    violationType: input.violationType,
    severity: input.severity,
    status: 'reported',
    fineAmount: input.fineAmount ?? null,
    reportedBy: input.reportedBy,
    reportedAt: now,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    photos: input.photos ?? null,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<ParkingViolation>);

  return {
    ...(doc as ParkingViolation),
    _id: result.insertedId.toString(),
  } as ParkingViolation;
}

export async function findParkingViolationById(
  violationId: string,
  organizationId?: string,
): Promise<ParkingViolation | null> {
  const collection = await getParkingViolationsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(violationId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

interface UpdateParkingViolationInput
  extends Partial<
    Omit<ParkingViolation, '_id' | 'organizationId' | 'reportedBy' | 'reportedAt' | 'createdAt'>
  > {}

export async function updateParkingViolation(
  violationId: string,
  organizationId: string,
  updates: UpdateParkingViolationInput,
): Promise<ParkingViolation | null> {
  const collection = await getParkingViolationsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingViolation = await findParkingViolationById(violationId, organizationId);
    if (!existingViolation) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // If resolving, set resolvedBy and resolvedAt
    if (updates.status === 'resolved' && existingViolation.status !== 'resolved') {
      updateDoc.resolvedAt = new Date();
      // resolvedBy should be set in the updates if provided
      if (!updateDoc.resolvedBy) {
        // Use the current user from context - this should be passed in updates
      }
    }

    // Validate buildingId if being updated
    if (
      updateDoc.buildingId !== undefined &&
      updateDoc.buildingId !== existingViolation.buildingId
    ) {
      await validateBuildingBelongsToOrg(updateDoc.buildingId as string, organizationId);
    }

    // Validate parking space if being updated
    if (
      updateDoc.parkingSpaceId !== undefined &&
      updateDoc.parkingSpaceId !== existingViolation.parkingSpaceId
    ) {
      await validateParkingSpaceBelongsToOrg(
        updateDoc.parkingSpaceId as string | null,
        organizationId,
      );
    }

    // Validate vehicle if being updated
    if (updateDoc.vehicleId !== undefined && updateDoc.vehicleId !== existingViolation.vehicleId) {
      await validateVehicleBelongsToOrg(updateDoc.vehicleId as string | null, organizationId);
    }

    // Validate tenant if being updated
    if (updateDoc.tenantId !== undefined && updateDoc.tenantId !== existingViolation.tenantId) {
      await validateTenantBelongsToOrg(updateDoc.tenantId as string | null, organizationId);
    }

    // Validate resolvedBy if being updated
    if (
      updateDoc.resolvedBy !== undefined &&
      updateDoc.resolvedBy !== existingViolation.resolvedBy
    ) {
      if (updateDoc.resolvedBy) {
        const resolvedByUser = await findUserById(updateDoc.resolvedBy as string);
        if (!resolvedByUser || resolvedByUser.organizationId !== organizationId) {
          throw new Error('Resolver user not found or does not belong to the organization');
        }
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(violationId), organizationId },
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result as ParkingViolation | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listParkingViolations(
  organizationId: string,
  filters: Record<string, unknown> = {},
): Promise<ParkingViolation[]> {
  const collection = await getParkingViolationsCollection();
  return collection
    .find({ organizationId, ...filters })
    .sort({ reportedAt: -1 })
    .toArray();
}

export async function deleteParkingViolation(
  violationId: string,
  organizationId: string,
): Promise<boolean> {
  const collection = await getParkingViolationsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const result = await collection.deleteOne({ _id: new ObjectId(violationId), organizationId });
    return result.deletedCount === 1;
  } catch {
    return false;
  }
}

