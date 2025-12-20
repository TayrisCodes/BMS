import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findVehicleById } from './vehicles';
import { findParkingSpaceById } from './parking-spaces';
import { findUserById } from '@/lib/auth/users';

const VEHICLE_MOVEMENTS_COLLECTION_NAME = 'vehicleMovements';

export type MovementType = 'entry' | 'exit' | 'reassignment';

export interface VehicleMovement {
  _id: string;
  organizationId: string;
  vehicleId: string; // ObjectId ref to vehicles
  parkingSpaceId?: string | null; // ObjectId ref to parking spaces (current space)
  fromParkingSpaceId?: string | null; // ObjectId ref to parking spaces (for reassignments)
  toParkingSpaceId?: string | null; // ObjectId ref to parking spaces (for reassignments)
  movementType: MovementType;
  assignmentId?: string | null; // ObjectId ref to parking assignments
  timestamp: Date;
  loggedBy: string; // ObjectId ref to users (or 'system' for automatic)
  notes?: string | null;
  createdAt: Date;
}

export async function getVehicleMovementsCollection(): Promise<Collection<VehicleMovement>> {
  const db = await getDb();
  return db.collection<VehicleMovement>(VEHICLE_MOVEMENTS_COLLECTION_NAME);
}

export async function ensureVehicleMovementIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(VEHICLE_MOVEMENTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId and vehicleId
    {
      key: { organizationId: 1, vehicleId: 1, timestamp: -1 },
      name: 'org_vehicle_timestamp',
    },
    // Index on movementType
    {
      key: { movementType: 1 },
      name: 'movementType',
    },
    // Index on timestamp
    {
      key: { timestamp: -1 },
      name: 'timestamp',
    },
    // Sparse index on assignmentId
    {
      key: { assignmentId: 1 },
      sparse: true,
      name: 'assignmentId_sparse',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a vehicle exists and belongs to the same organization.
 */
async function validateVehicleBelongsToOrg(
  vehicleId: string,
  organizationId: string,
): Promise<void> {
  const vehicle = await findVehicleById(vehicleId, organizationId);
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }
  if (vehicle.organizationId !== organizationId) {
    throw new Error('Vehicle does not belong to the same organization');
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

export interface CreateVehicleMovementInput {
  organizationId: string;
  vehicleId: string;
  parkingSpaceId?: string | null;
  fromParkingSpaceId?: string | null;
  toParkingSpaceId?: string | null;
  movementType: MovementType;
  assignmentId?: string | null;
  timestamp?: Date;
  loggedBy: string;
  notes?: string | null;
}

export async function createVehicleMovement(
  input: CreateVehicleMovementInput,
): Promise<VehicleMovement> {
  const collection = await getVehicleMovementsCollection();
  const now = new Date();

  // Validate vehicle exists and belongs to same org
  await validateVehicleBelongsToOrg(input.vehicleId, input.organizationId);

  // Validate parking space if provided
  if (input.movementType === 'entry' || input.movementType === 'exit') {
    await validateParkingSpaceBelongsToOrg(input.parkingSpaceId, input.organizationId);
  } else if (input.movementType === 'reassignment') {
    await validateParkingSpaceBelongsToOrg(input.fromParkingSpaceId, input.organizationId);
    await validateParkingSpaceBelongsToOrg(input.toParkingSpaceId, input.organizationId);
  }

  // Validate loggedBy user (unless it's 'system')
  if (input.loggedBy !== 'system') {
    const user = await findUserById(input.loggedBy);
    if (!user || user.organizationId !== input.organizationId) {
      throw new Error('User not found or does not belong to the organization');
    }
  }

  // Validate required fields
  if (!input.movementType) {
    throw new Error('movementType is required');
  }

  const doc: Omit<VehicleMovement, '_id'> = {
    organizationId: input.organizationId,
    vehicleId: input.vehicleId,
    parkingSpaceId: input.parkingSpaceId ?? null,
    fromParkingSpaceId: input.fromParkingSpaceId ?? null,
    toParkingSpaceId: input.toParkingSpaceId ?? null,
    movementType: input.movementType,
    assignmentId: input.assignmentId ?? null,
    timestamp: input.timestamp || now,
    loggedBy: input.loggedBy,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<VehicleMovement>);

  return {
    ...(doc as VehicleMovement),
    _id: result.insertedId.toString(),
  } as VehicleMovement;
}

export async function findVehicleMovementsByVehicle(
  vehicleId: string,
  organizationId?: string,
  filters: Record<string, unknown> = {},
): Promise<VehicleMovement[]> {
  const collection = await getVehicleMovementsCollection();

  const query: Record<string, unknown> = {
    vehicleId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ timestamp: -1 })
    .toArray();
}

export async function listVehicleMovements(
  organizationId: string,
  filters: Record<string, unknown> = {},
): Promise<VehicleMovement[]> {
  const collection = await getVehicleMovementsCollection();
  return collection
    .find({ organizationId, ...filters })
    .sort({ timestamp: -1 })
    .toArray();
}

