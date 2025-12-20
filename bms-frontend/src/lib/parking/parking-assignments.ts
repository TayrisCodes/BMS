import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findParkingSpaceById } from '@/lib/parking/parking-spaces';
import { findTenantById } from '@/lib/tenants/tenants';
import { findVisitorLogById } from '@/lib/security/visitor-logs';
import { findActivePricing } from './parking-pricing';

const PARKING_ASSIGNMENTS_COLLECTION_NAME = 'parkingAssignments';

export type AssignmentType = 'tenant' | 'visitor';
export type BillingPeriod = 'monthly' | 'daily' | 'hourly';
export type AssignmentStatus = 'active' | 'completed' | 'cancelled';

export interface ParkingAssignment {
  _id: string;
  organizationId: string;
  parkingSpaceId: string; // ObjectId ref to parking spaces
  buildingId: string; // ObjectId ref to buildings
  assignmentType: AssignmentType;
  tenantId?: string | null; // ObjectId ref to tenants (for tenant assignments)
  visitorLogId?: string | null; // ObjectId ref to visitor logs (for visitor assignments)
  vehicleId?: string | null; // ObjectId ref to vehicles
  startDate: Date;
  endDate?: Date | null;
  actualStartTime?: Date | null; // When vehicle actually entered
  actualEndTime?: Date | null; // When vehicle actually exited
  calculatedDuration?: number | null; // Duration in minutes
  billedDuration?: number | null; // Billed duration in minutes (for visitor parking)
  pricingId: string; // ObjectId ref to parking pricing
  billingPeriod: BillingPeriod;
  rate: number; // Rate at time of assignment
  invoiceId?: string | null; // ObjectId ref to invoices (generated invoice)
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export async function getParkingAssignmentsCollection(): Promise<Collection<ParkingAssignment>> {
  const db = await getDb();
  return db.collection<ParkingAssignment>(PARKING_ASSIGNMENTS_COLLECTION_NAME);
}

export async function ensureParkingAssignmentIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PARKING_ASSIGNMENTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, and status
    {
      key: { organizationId: 1, buildingId: 1, status: 1 },
      name: 'org_building_status',
    },
    // Index on parkingSpaceId
    {
      key: { parkingSpaceId: 1 },
      name: 'parkingSpaceId',
    },
    // Sparse index on tenantId
    {
      key: { tenantId: 1 },
      sparse: true,
      name: 'tenantId_sparse',
    },
    // Sparse index on visitorLogId
    {
      key: { visitorLogId: 1 },
      sparse: true,
      name: 'visitorLogId_sparse',
    },
    // Index on startDate
    {
      key: { startDate: -1 },
      name: 'startDate',
    },
  ];

  await collection.createIndexes(indexes);
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

/**
 * Validates that a visitor log exists and belongs to the same organization (if provided).
 */
async function validateVisitorLogBelongsToOrg(
  visitorLogId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!visitorLogId) {
    return;
  }

  const visitorLog = await findVisitorLogById(visitorLogId, organizationId);
  if (!visitorLog) {
    throw new Error('Visitor log not found');
  }
  if (visitorLog.organizationId !== organizationId) {
    throw new Error('Visitor log does not belong to the same organization');
  }
}

export interface CreateParkingAssignmentInput {
  organizationId: string;
  parkingSpaceId: string;
  assignmentType: AssignmentType;
  tenantId?: string | null;
  visitorLogId?: string | null;
  vehicleId?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  pricingId?: string; // Optional - will fetch active pricing if not provided
  billingPeriod?: BillingPeriod; // Optional - will use pricing model if not provided
  rate?: number; // Optional - will use pricing rate if not provided
}

export async function createParkingAssignment(
  input: CreateParkingAssignmentInput,
): Promise<ParkingAssignment> {
  const collection = await getParkingAssignmentsCollection();
  const now = new Date();

  // Validate parking space exists and belongs to same org
  const { buildingId } = await validateParkingSpaceBelongsToOrg(
    input.parkingSpaceId,
    input.organizationId,
  );

  // Validate tenant or visitor log based on assignment type
  if (input.assignmentType === 'tenant') {
    await validateTenantBelongsToOrg(input.tenantId, input.organizationId);
    if (!input.tenantId) {
      throw new Error('Tenant ID is required for tenant assignments');
    }
  } else if (input.assignmentType === 'visitor') {
    await validateVisitorLogBelongsToOrg(input.visitorLogId, input.organizationId);
    if (!input.visitorLogId) {
      throw new Error('Visitor log ID is required for visitor assignments');
    }
  }

  // Check if parking space is already assigned (active assignment)
  const existingAssignment = await collection.findOne({
    parkingSpaceId: input.parkingSpaceId,
    status: 'active',
  } as Document);

  if (existingAssignment) {
    throw new Error('Parking space is already assigned');
  }

  // Get pricing if not provided
  let pricingId = input.pricingId;
  let billingPeriod = input.billingPeriod;
  let rate = input.rate;

  if (!pricingId || !billingPeriod || !rate) {
    const parkingSpace = await findParkingSpaceById(input.parkingSpaceId, input.organizationId);
    if (!parkingSpace) {
      throw new Error('Parking space not found');
    }

    const activePricing = await findActivePricing(
      buildingId,
      parkingSpace.spaceType,
      input.organizationId,
      typeof input.startDate === 'string' ? new Date(input.startDate) : input.startDate,
    );

    if (!activePricing) {
      throw new Error(
        `No active pricing found for ${parkingSpace.spaceType} parking in this building`,
      );
    }

    pricingId = activePricing._id;
    billingPeriod = (input.billingPeriod || activePricing.pricingModel) as BillingPeriod;

    // Set rate based on billing period
    if (billingPeriod === 'monthly') {
      rate = input.rate || activePricing.monthlyRate || 0;
    } else if (billingPeriod === 'daily') {
      rate = input.rate || activePricing.dailyRate || 0;
    } else if (billingPeriod === 'hourly') {
      rate = input.rate || activePricing.hourlyRate || 0;
    } else {
      rate = input.rate || 0;
    }
  }

  const actualStartTime =
    input.actualStartTime && typeof input.actualStartTime === 'string'
      ? new Date(input.actualStartTime)
      : input.actualStartTime || now;

  const doc: Omit<ParkingAssignment, '_id'> = {
    organizationId: input.organizationId,
    parkingSpaceId: input.parkingSpaceId,
    buildingId,
    assignmentType: input.assignmentType,
    tenantId: input.tenantId || null,
    visitorLogId: input.visitorLogId || null,
    vehicleId: input.vehicleId || null,
    startDate: typeof input.startDate === 'string' ? new Date(input.startDate) : input.startDate,
    endDate:
      input.endDate && typeof input.endDate === 'string'
        ? new Date(input.endDate)
        : input.endDate || null,
    actualStartTime: actualStartTime,
    actualEndTime: null,
    calculatedDuration: null,
    billedDuration: null,
    pricingId,
    billingPeriod: billingPeriod!,
    rate: rate!,
    invoiceId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<ParkingAssignment>);

  const createdAssignment = {
    ...(doc as ParkingAssignment),
    _id: result.insertedId.toString(),
  } as ParkingAssignment;

  // Auto-create entry log if vehicle and parking space are provided
  if (createdAssignment.vehicleId && createdAssignment.parkingSpaceId) {
    try {
      const { createParkingLog } = await import('./parking-logs');
      await createParkingLog({
        organizationId: input.organizationId,
        vehicleId: createdAssignment.vehicleId,
        parkingSpaceId: createdAssignment.parkingSpaceId,
        logType: 'entry',
        timestamp: actualStartTime,
        loggedBy: 'system',
        assignmentId: createdAssignment._id,
      });
    } catch (error) {
      // Log error but don't fail assignment creation
      console.error('Failed to create entry log for assignment:', error);
    }
  }

  return createdAssignment;
}

export async function findParkingAssignmentById(
  assignmentId: string,
  organizationId?: string,
): Promise<ParkingAssignment | null> {
  const collection = await getParkingAssignmentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(assignmentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export interface ListParkingAssignmentsFilters {
  organizationId?: string;
  buildingId?: string;
  tenantId?: string;
  visitorLogId?: string;
  parkingSpaceId?: string;
  status?: AssignmentStatus;
  assignmentType?: AssignmentType;
}

export async function listParkingAssignments(
  filters: ListParkingAssignmentsFilters = {},
): Promise<ParkingAssignment[]> {
  const collection = await getParkingAssignmentsCollection();

  const query: Record<string, unknown> = {};

  if (filters.organizationId) {
    query.organizationId = filters.organizationId;
  }

  if (filters.buildingId) {
    query.buildingId = filters.buildingId;
  }

  if (filters.tenantId) {
    query.tenantId = filters.tenantId;
  }

  if (filters.visitorLogId) {
    query.visitorLogId = filters.visitorLogId;
  }

  if (filters.parkingSpaceId) {
    query.parkingSpaceId = filters.parkingSpaceId;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.assignmentType) {
    query.assignmentType = filters.assignmentType;
  }

  return collection
    .find(query as Document)
    .sort({ startDate: -1 })
    .toArray();
}

export async function findActiveAssignments(
  filters: {
    organizationId?: string;
    buildingId?: string;
    tenantId?: string;
    visitorLogId?: string;
    parkingSpaceId?: string;
  } = {},
): Promise<ParkingAssignment[]> {
  return listParkingAssignments({
    ...filters,
    status: 'active',
  });
}

export async function updateParkingAssignment(
  assignmentId: string,
  updates: Partial<ParkingAssignment>,
): Promise<ParkingAssignment | null> {
  const collection = await getParkingAssignmentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingAssignment = await findParkingAssignmentById(assignmentId);
    if (!existingAssignment) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Convert date strings to Date objects if present
    if (updateDoc.startDate && typeof updateDoc.startDate === 'string') {
      updateDoc.startDate = new Date(updateDoc.startDate);
    }
    if (updateDoc.endDate && typeof updateDoc.endDate === 'string') {
      updateDoc.endDate = new Date(updateDoc.endDate);
    }

    // Remove fields that shouldn't be updated
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(assignmentId) },
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result || null;
  } catch {
    return null;
  }
}

/**
 * Ends a parking assignment and calculates final amount for visitor parking.
 * For tenant monthly parking, this just marks it as completed.
 * For visitor hourly/daily parking, calculates the amount based on duration.
 */
export async function endParkingAssignment(
  assignmentId: string,
  endDate?: Date,
  actualEndTime?: Date,
): Promise<{ assignment: ParkingAssignment; calculatedAmount: number }> {
  const assignment = await findParkingAssignmentById(assignmentId);
  if (!assignment) {
    throw new Error('Parking assignment not found');
  }

  if (assignment.status !== 'active') {
    throw new Error('Only active assignments can be ended');
  }

  const finalEndDate = endDate || new Date();
  const finalActualEndTime = actualEndTime || finalEndDate;
  const startTime = assignment.actualStartTime
    ? new Date(assignment.actualStartTime)
    : new Date(assignment.startDate);
  const durationMs = finalActualEndTime.getTime() - startTime.getTime();
  const calculatedDuration = Math.round(durationMs / (1000 * 60)); // Duration in minutes

  let calculatedAmount = 0;
  let billedDuration = calculatedDuration;

  // Calculate amount based on billing period
  if (assignment.billingPeriod === 'monthly') {
    // For monthly, use the rate as-is (pro-rated if needed)
    calculatedAmount = assignment.rate;
    billedDuration = calculatedDuration; // Full duration for monthly
  } else if (assignment.billingPeriod === 'daily') {
    // Calculate number of days (round up)
    const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    calculatedAmount = assignment.rate * days;
    billedDuration = days * 24 * 60; // Billed duration in minutes
  } else if (assignment.billingPeriod === 'hourly') {
    // Calculate number of hours (round up)
    const hours = Math.ceil(durationMs / (1000 * 60 * 60));
    calculatedAmount = assignment.rate * hours;
    billedDuration = hours * 60; // Billed duration in minutes
  }

  // Update assignment
  const updatedAssignment = await updateParkingAssignment(assignmentId, {
    endDate: finalEndDate,
    actualEndTime: finalActualEndTime,
    calculatedDuration,
    billedDuration,
    status: 'completed',
  });

  if (!updatedAssignment) {
    throw new Error('Failed to update parking assignment');
  }

  // Auto-create exit log if vehicle and parking space are provided
  if (updatedAssignment.vehicleId && updatedAssignment.parkingSpaceId) {
    try {
      const { createParkingLog } = await import('./parking-logs');
      await createParkingLog({
        organizationId: updatedAssignment.organizationId,
        vehicleId: updatedAssignment.vehicleId,
        parkingSpaceId: updatedAssignment.parkingSpaceId,
        logType: 'exit',
        timestamp: finalActualEndTime,
        loggedBy: 'system',
        assignmentId: updatedAssignment._id,
        duration: calculatedDuration,
      });
    } catch (error) {
      // Log error but don't fail assignment update
      console.error('Failed to create exit log for assignment:', error);
    }
  }

  return {
    assignment: updatedAssignment,
    calculatedAmount,
  };
}

export async function deleteParkingAssignment(
  assignmentId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getParkingAssignmentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(assignmentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount === 1;
  } catch {
    return false;
  }
}
