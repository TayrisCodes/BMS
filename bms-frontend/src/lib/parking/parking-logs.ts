import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findVehicleById } from './vehicles';
import { findParkingSpaceById } from './parking-spaces';
import { findParkingAssignmentById } from './parking-assignments';
import { findUserById } from '@/lib/auth/users';

const PARKING_LOGS_COLLECTION_NAME = 'parkingLogs';

export type ParkingLogType = 'entry' | 'exit';

export interface ParkingLog {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  vehicleId: string; // ObjectId ref to vehicles
  parkingSpaceId: string; // ObjectId ref to parking spaces
  logType: ParkingLogType;
  timestamp: Date;
  loggedBy: string; // ObjectId ref to users (or 'system' for automatic)
  assignmentId?: string | null; // ObjectId ref to parking assignments
  duration?: number | null; // Duration in minutes (calculated on exit)
  notes?: string | null;
  photos?: string[] | null; // URLs or file paths
  createdAt: Date;
}

export async function getParkingLogsCollection(): Promise<Collection<ParkingLog>> {
  const db = await getDb();
  return db.collection<ParkingLog>(PARKING_LOGS_COLLECTION_NAME);
}

export async function ensureParkingLogIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PARKING_LOGS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and timestamp
    {
      key: { organizationId: 1, buildingId: 1, timestamp: -1 },
      name: 'org_building_timestamp',
    },
    // Compound index on vehicleId and timestamp
    {
      key: { vehicleId: 1, timestamp: -1 },
      name: 'vehicle_timestamp',
    },
    // Index on logType
    {
      key: { logType: 1 },
      name: 'logType',
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
 * Validates that a parking space exists and belongs to the same organization.
 */
async function validateParkingSpaceBelongsToOrg(
  parkingSpaceId: string,
  organizationId: string,
): Promise<{ buildingId: string }> {
  const parkingSpace = await findParkingSpaceById(parkingSpaceId, organizationId);
  if (!parkingSpace) {
    throw new Error('Parking space not found');
  }
  if (parkingSpace.organizationId !== organizationId) {
    throw new Error('Parking space does not belong to the same organization');
  }
  return { buildingId: parkingSpace.buildingId };
}

export interface CreateParkingLogInput {
  organizationId: string;
  vehicleId: string;
  parkingSpaceId: string;
  logType: ParkingLogType;
  timestamp?: Date;
  loggedBy: string;
  assignmentId?: string | null;
  duration?: number | null;
  notes?: string | null;
  photos?: string[] | null;
}

export async function createParkingLog(input: CreateParkingLogInput): Promise<ParkingLog> {
  const collection = await getParkingLogsCollection();
  const now = new Date();

  // Validate vehicle exists and belongs to same org
  await validateVehicleBelongsToOrg(input.vehicleId, input.organizationId);

  // Validate parking space exists and get buildingId
  const { buildingId } = await validateParkingSpaceBelongsToOrg(
    input.parkingSpaceId,
    input.organizationId,
  );

  // Validate assignment if provided
  if (input.assignmentId) {
    const assignment = await findParkingAssignmentById(input.assignmentId, input.organizationId);
    if (!assignment) {
      throw new Error('Parking assignment not found');
    }
    if (assignment.organizationId !== input.organizationId) {
      throw new Error('Parking assignment does not belong to the same organization');
    }
  }

  // Validate loggedBy user (unless it's 'system')
  if (input.loggedBy !== 'system') {
    const user = await findUserById(input.loggedBy);
    if (!user || user.organizationId !== input.organizationId) {
      throw new Error('User not found or does not belong to the organization');
    }
  }

  // Validate required fields
  if (!input.logType) {
    throw new Error('logType is required');
  }

  // If exit log, try to calculate duration from last entry log
  let duration = input.duration;
  if (input.logType === 'exit' && !duration && input.assignmentId) {
    const assignment = await findParkingAssignmentById(input.assignmentId, input.organizationId);
    if (assignment) {
      const entryLog = await collection.findOne({
        organizationId: input.organizationId,
        vehicleId: input.vehicleId,
        parkingSpaceId: input.parkingSpaceId,
        logType: 'entry',
        assignmentId: input.assignmentId,
      } as Document);

      if (entryLog) {
        const entryTime =
          entryLog.timestamp instanceof Date ? entryLog.timestamp : new Date(entryLog.timestamp);
        const exitTime = input.timestamp || now;
        duration = Math.round((exitTime.getTime() - entryTime.getTime()) / (1000 * 60)); // Duration in minutes
      }
    }
  }

  const doc: Omit<ParkingLog, '_id'> = {
    organizationId: input.organizationId,
    buildingId,
    vehicleId: input.vehicleId,
    parkingSpaceId: input.parkingSpaceId,
    logType: input.logType,
    timestamp: input.timestamp || now,
    loggedBy: input.loggedBy,
    assignmentId: input.assignmentId ?? null,
    duration: duration ?? null,
    notes: input.notes?.trim() ?? null,
    photos: input.photos ?? null,
    createdAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<ParkingLog>);

  return {
    ...(doc as ParkingLog),
    _id: result.insertedId.toString(),
  } as ParkingLog;
}

export async function findParkingLogById(
  logId: string,
  organizationId?: string,
): Promise<ParkingLog | null> {
  const collection = await getParkingLogsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(logId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function listParkingLogs(
  organizationId: string,
  filters: Record<string, unknown> = {},
): Promise<ParkingLog[]> {
  const collection = await getParkingLogsCollection();
  return collection
    .find({ organizationId, ...filters })
    .sort({ timestamp: -1 })
    .toArray();
}

export async function findLastEntryLog(
  vehicleId: string,
  parkingSpaceId: string,
  assignmentId: string | null,
  organizationId: string,
): Promise<ParkingLog | null> {
  const collection = await getParkingLogsCollection();

  const query: Record<string, unknown> = {
    organizationId,
    vehicleId,
    parkingSpaceId,
    logType: 'entry',
  };

  if (assignmentId) {
    query.assignmentId = assignmentId;
  }

  return collection.findOne(query as Document, { sort: { timestamp: -1 } });
}

