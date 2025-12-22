import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findSecurityStaffById } from './security-staff';

const SHIFTS_COLLECTION_NAME = 'shifts';

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';
export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface Shift {
  _id: string;
  organizationId: string;
  buildingId: string;
  securityStaffId: string; // ObjectId ref to security staff
  shiftType: ShiftType;
  startTime: Date;
  endTime: Date;
  status: ShiftStatus;
  notes?: string | null;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  createdBy: string; // ObjectId ref to users
  createdAt: Date;
  updatedAt: Date;
}

export async function getShiftsCollection(): Promise<Collection<Shift>> {
  const db = await getDb();
  return db.collection<Shift>(SHIFTS_COLLECTION_NAME);
}

export async function ensureShiftIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(SHIFTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and startTime
    {
      key: { organizationId: 1, buildingId: 1, startTime: -1 },
      name: 'org_building_start_time',
    },
    // Index on securityStaffId
    {
      key: { securityStaffId: 1 },
      name: 'securityStaffId',
    },
    // Index on status
    {
      key: { status: 1 },
      name: 'status',
    },
    // Index on startTime for date range queries
    {
      key: { startTime: 1 },
      name: 'startTime',
    },
    // Compound index for finding active shifts
    {
      key: { securityStaffId: 1, status: 1, startTime: 1 },
      name: 'staff_active_shifts',
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
 * Validates that security staff exists and belongs to the same organization.
 */
async function validateSecurityStaffBelongsToOrg(
  securityStaffId: string,
  organizationId: string,
): Promise<void> {
  const securityStaff = await findSecurityStaffById(securityStaffId, organizationId);
  if (!securityStaff) {
    throw new Error('Security staff not found');
  }
  if (securityStaff.organizationId !== organizationId) {
    throw new Error('Security staff does not belong to the same organization');
  }
}

/**
 * Validates that shift times are valid (endTime after startTime).
 */
function validateShiftTimes(startTime: Date, endTime: Date): void {
  if (endTime <= startTime) {
    throw new Error('End time must be after start time');
  }
}

/**
 * Checks for overlapping shifts for the same security staff.
 */
export async function findOverlappingShifts(
  securityStaffId: string,
  startTime: Date,
  endTime: Date,
  excludeShiftId?: string,
): Promise<Shift[]> {
  const collection = await getShiftsCollection();

  const query: Record<string, unknown> = {
    securityStaffId,
    status: { $ne: 'cancelled' },
    $or: [
      // Shift starts during existing shift
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime },
      },
      // Shift ends during existing shift
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime },
      },
      // Shift completely contains existing shift
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime },
      },
    ],
  };

  if (excludeShiftId) {
    const { ObjectId } = await import('mongodb');
    query._id = { $ne: new ObjectId(excludeShiftId) };
  }

  return collection.find(query as Document).toArray();
}

export interface CreateShiftInput {
  organizationId: string;
  buildingId: string;
  securityStaffId: string;
  shiftType: ShiftType;
  startTime: Date;
  endTime: Date;
  status?: ShiftStatus;
  notes?: string | null;
  createdBy: string;
}

export async function createShift(input: CreateShiftInput): Promise<Shift> {
  const collection = await getShiftsCollection();
  const now = new Date();

  // Validate building
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate security staff
  await validateSecurityStaffBelongsToOrg(input.securityStaffId, input.organizationId);

  // Validate shift times
  validateShiftTimes(input.startTime, input.endTime);

  // Check for overlapping shifts
  const overlapping = await findOverlappingShifts(
    input.securityStaffId,
    input.startTime,
    input.endTime,
  );
  if (overlapping.length > 0) {
    throw new Error('Shift overlaps with existing shift for this security staff');
  }

  // Validate required fields
  if (!input.securityStaffId || !input.buildingId || !input.createdBy) {
    throw new Error('securityStaffId, buildingId, and createdBy are required');
  }

  const doc: Omit<Shift, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    securityStaffId: input.securityStaffId,
    shiftType: input.shiftType,
    startTime: input.startTime,
    endTime: input.endTime,
    status: input.status ?? 'scheduled',
    notes: input.notes?.trim() ?? null,
    checkInTime: null,
    checkOutTime: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Shift>);

  return {
    ...(doc as Shift),
    _id: result.insertedId.toString(),
  } as Shift;
}

export async function findShiftById(
  shiftId: string,
  organizationId?: string,
): Promise<Shift | null> {
  const collection = await getShiftsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(shiftId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findShiftsBySecurityStaff(
  securityStaffId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<Shift[]> {
  const collection = await getShiftsCollection();

  const query: Record<string, unknown> = {
    securityStaffId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ startTime: -1 })
    .toArray();
}

export async function findShiftsByBuilding(
  buildingId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<Shift[]> {
  const collection = await getShiftsCollection();

  const query: Record<string, unknown> = {
    buildingId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ startTime: -1 })
    .toArray();
}

export async function findActiveShifts(
  securityStaffId?: string,
  buildingId?: string,
  organizationId?: string,
): Promise<Shift[]> {
  const collection = await getShiftsCollection();

  const query: Record<string, unknown> = {
    status: 'active',
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }
  if (buildingId) {
    query.buildingId = buildingId;
  }
  if (securityStaffId) {
    query.securityStaffId = securityStaffId;
  }

  return collection
    .find(query as Document)
    .sort({ startTime: -1 })
    .toArray();
}

export async function listShifts(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<Shift[]> {
  const collection = await getShiftsCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection
    .find(query as Document)
    .sort({ startTime: -1 })
    .toArray();
}

export async function updateShift(
  shiftId: string,
  updates: Partial<
    CreateShiftInput & {
      status?: ShiftStatus;
      checkInTime?: Date | null;
      checkOutTime?: Date | null;
    }
  >,
  organizationId?: string,
): Promise<Shift | null> {
  const collection = await getShiftsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findShiftById(shiftId, organizationId);
    if (!existing) {
      return null;
    }

    // Validate building if being updated
    if (updates.buildingId !== undefined && updates.buildingId !== existing.buildingId) {
      await validateBuildingBelongsToOrg(updates.buildingId, existing.organizationId);
    }

    // Validate security staff if being updated
    if (
      updates.securityStaffId !== undefined &&
      updates.securityStaffId !== existing.securityStaffId
    ) {
      await validateSecurityStaffBelongsToOrg(updates.securityStaffId, existing.organizationId);
    }

    // Validate shift times if being updated
    const startTime = updates.startTime ?? existing.startTime;
    const endTime = updates.endTime ?? existing.endTime;
    if (updates.startTime !== undefined || updates.endTime !== undefined) {
      validateShiftTimes(startTime, endTime);

      // Check for overlapping shifts (excluding current shift)
      const overlapping = await findOverlappingShifts(
        updates.securityStaffId ?? existing.securityStaffId,
        startTime,
        endTime,
        shiftId,
      );
      if (overlapping.length > 0) {
        throw new Error('Shift overlaps with existing shift for this security staff');
      }
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
      { _id: new ObjectId(shiftId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Shift | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function checkInShift(shiftId: string, checkInTime?: Date): Promise<Shift | null> {
  const collection = await getShiftsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findShiftById(shiftId);
    if (!existing) {
      return null;
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error('Cannot check in to a completed or cancelled shift');
    }

    const now = checkInTime ?? new Date();

    // Validate check-in time is within shift window (allow 30 minutes before start)
    const thirtyMinutesBefore = new Date(existing.startTime.getTime() - 30 * 60 * 1000);
    if (now < thirtyMinutesBefore) {
      throw new Error('Check-in time is too early (more than 30 minutes before shift start)');
    }

    if (now > existing.endTime) {
      throw new Error('Check-in time is after shift end time');
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(shiftId) } as Document,
      {
        $set: {
          checkInTime: now,
          status: 'active',
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as Shift | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function checkOutShift(shiftId: string, checkOutTime?: Date): Promise<Shift | null> {
  const collection = await getShiftsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existing = await findShiftById(shiftId);
    if (!existing) {
      return null;
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error('Cannot check out from a completed or cancelled shift');
    }

    if (!existing.checkInTime) {
      throw new Error('Cannot check out without checking in first');
    }

    const now = checkOutTime ?? new Date();

    // Validate check-out time is after check-in time
    if (now < existing.checkInTime) {
      throw new Error('Check-out time cannot be before check-in time');
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(shiftId) } as Document,
      {
        $set: {
          checkOutTime: now,
          status: 'completed',
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as Shift | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteShift(shiftId: string, organizationId?: string): Promise<boolean> {
  const collection = await getShiftsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(shiftId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount > 0;
  } catch {
    return false;
  }
}
