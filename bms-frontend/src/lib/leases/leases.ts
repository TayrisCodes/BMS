import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findTenantById } from '@/lib/tenants/tenants';
import { findUnitById, updateUnit, type UnitStatus } from '@/lib/units/units';

const LEASES_COLLECTION_NAME = 'leases';

export type BillingCycle = 'monthly' | 'quarterly' | 'annually';
export type LeaseStatus = 'active' | 'expired' | 'terminated' | 'pending';
export type ChargeFrequency = 'monthly' | 'quarterly' | 'annually' | 'one-time';

export interface AdditionalCharge {
  name: string;
  amount: number;
  frequency: ChargeFrequency;
}

export interface Lease {
  _id: string;
  organizationId: string;
  tenantId: string; // ObjectId ref to tenants
  unitId: string; // ObjectId ref to units
  startDate: Date;
  endDate?: Date | null; // null for month-to-month
  rentAmount: number; // ETB
  depositAmount?: number | null; // ETB
  billingCycle: BillingCycle;
  dueDay: number; // 1-31, day of month
  additionalCharges?: AdditionalCharge[] | null;
  status: LeaseStatus;
  terminationDate?: Date | null;
  terminationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getLeasesCollection(): Promise<Collection<Lease>> {
  const db = await getDb();
  return db.collection<Lease>(LEASES_COLLECTION_NAME);
}

export async function ensureLeaseIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(LEASES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, tenantId, and status
    {
      key: { organizationId: 1, tenantId: 1, status: 1 },
      name: 'org_tenant_status',
    },
    // Compound index on organizationId, unitId, and status
    {
      key: { organizationId: 1, unitId: 1, status: 1 },
      name: 'org_unit_status',
    },
    // Index on startDate
    {
      key: { startDate: 1 },
      name: 'startDate',
    },
    // Index on endDate
    {
      key: { endDate: 1 },
      name: 'endDate',
    },
    // Index on status
    {
      key: { status: 1 },
      name: 'status',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a tenant belongs to the same organization.
 * Throws an error if validation fails.
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
 * Validates that a unit is available (no active lease).
 * Throws an error if validation fails.
 */
async function validateUnitIsAvailable(unitId: string, organizationId: string): Promise<void> {
  const unit = await findUnitById(unitId, organizationId);
  if (!unit) {
    throw new Error('Unit not found');
  }
  if (unit.organizationId !== organizationId) {
    throw new Error('Unit does not belong to the same organization');
  }

  // Check if unit has an active lease
  const activeLease = await findActiveLeaseForUnit(unitId, organizationId);
  if (activeLease) {
    throw new Error('Unit already has an active lease');
  }
}

/**
 * Validates that dates are valid.
 * Throws an error if validation fails.
 */
function validateLeaseDates(startDate: Date, endDate?: Date | null): void {
  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }

  if (end && isNaN(end.getTime())) {
    throw new Error('Invalid end date');
  }

  if (end && end <= start) {
    throw new Error('End date must be after start date');
  }
}

export interface CreateLeaseInput {
  organizationId: string;
  tenantId: string;
  unitId: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  rentAmount: number;
  depositAmount?: number | null;
  billingCycle: BillingCycle;
  dueDay: number;
  additionalCharges?: AdditionalCharge[] | null;
  status?: LeaseStatus;
}

export async function createLease(input: CreateLeaseInput): Promise<Lease> {
  const collection = await getLeasesCollection();
  const now = new Date();

  // Validate tenant exists and belongs to same org
  await validateTenantBelongsToOrg(input.tenantId, input.organizationId);

  // Validate unit is available (no active lease)
  await validateUnitIsAvailable(input.unitId, input.organizationId);

  // Convert dates to Date objects if strings
  const startDate =
    typeof input.startDate === 'string' ? new Date(input.startDate) : input.startDate;
  const endDate = input.endDate
    ? typeof input.endDate === 'string'
      ? new Date(input.endDate)
      : input.endDate
    : null;

  // Validate dates
  validateLeaseDates(startDate, endDate);

  // Validate dueDay is between 1-31
  if (input.dueDay < 1 || input.dueDay > 31) {
    throw new Error('dueDay must be between 1 and 31');
  }

  const doc: Omit<Lease, '_id'> = {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    unitId: input.unitId,
    startDate,
    endDate,
    rentAmount: input.rentAmount,
    depositAmount: input.depositAmount ?? null,
    billingCycle: input.billingCycle,
    dueDay: input.dueDay,
    additionalCharges: input.additionalCharges ?? null,
    status: input.status ?? 'active',
    terminationDate: null,
    terminationReason: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Lease>);

  // Update unit status to "occupied" if lease is active
  if (doc.status === 'active') {
    await updateUnit(input.unitId, { status: 'occupied' as UnitStatus }).catch((error) => {
      console.error('Failed to update unit status to occupied:', error);
      // Don't throw - lease is already created
    });
  }

  return {
    ...(doc as Lease),
    _id: result.insertedId.toString(),
  } as Lease;
}

export async function findLeaseById(
  leaseId: string,
  organizationId?: string,
): Promise<Lease | null> {
  const collection = await getLeasesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(leaseId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findLeasesByTenant(
  tenantId: string,
  organizationId?: string,
): Promise<Lease[]> {
  const collection = await getLeasesCollection();

  const query: Record<string, unknown> = {
    tenantId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.find(query as Document).toArray();
}

export async function findLeasesByUnit(unitId: string, organizationId?: string): Promise<Lease[]> {
  const collection = await getLeasesCollection();

  const query: Record<string, unknown> = {
    unitId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.find(query as Document).toArray();
}

export async function findActiveLeaseForUnit(
  unitId: string,
  organizationId?: string,
): Promise<Lease | null> {
  const collection = await getLeasesCollection();
  const now = new Date();

  const query: Record<string, unknown> = {
    unitId,
    status: 'active',
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  // Find active lease that hasn't expired
  return collection.findOne({
    ...query,
    $or: [
      { endDate: null }, // Month-to-month leases
      { endDate: { $gte: now } }, // Fixed-term leases that haven't expired
    ],
  } as Document);
}

export async function updateLease(leaseId: string, updates: Partial<Lease>): Promise<Lease | null> {
  const collection = await getLeasesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Get existing lease
    const existingLease = await findLeaseById(leaseId);
    if (!existingLease) {
      return null;
    }

    // If dates are being updated, validate them
    if (updates.startDate || updates.endDate !== undefined) {
      const startDate = updates.startDate
        ? typeof updates.startDate === 'string'
          ? new Date(updates.startDate)
          : updates.startDate
        : existingLease.startDate;
      const endDate =
        updates.endDate !== undefined
          ? updates.endDate
            ? typeof updates.endDate === 'string'
              ? new Date(updates.endDate)
              : updates.endDate
            : null
          : existingLease.endDate;

      validateLeaseDates(startDate, endDate);
    }

    // If tenantId is being updated, validate tenant
    if (updates.tenantId && updates.tenantId !== existingLease.tenantId) {
      await validateTenantBelongsToOrg(updates.tenantId, existingLease.organizationId);
    }

    // If unitId is being updated, validate unit and availability
    if (updates.unitId && updates.unitId !== existingLease.unitId) {
      await validateUnitIsAvailable(updates.unitId, existingLease.organizationId);
      // Update old unit status back to available
      await updateUnit(existingLease.unitId, { status: 'available' as UnitStatus }).catch(
        (error) => {
          console.error('Failed to update old unit status:', error);
        },
      );
      // Update new unit status to occupied if lease is active
      if (existingLease.status === 'active' || updates.status === 'active') {
        await updateUnit(updates.unitId, { status: 'occupied' as UnitStatus }).catch((error) => {
          console.error('Failed to update new unit status:', error);
        });
      }
    }

    // If status is changing from active to terminated/expired, update unit status
    if (updates.status && updates.status !== existingLease.status) {
      if (
        existingLease.status === 'active' &&
        (updates.status === 'terminated' || updates.status === 'expired')
      ) {
        await updateUnit(existingLease.unitId, { status: 'available' as UnitStatus }).catch(
          (error) => {
            console.error('Failed to update unit status:', error);
          },
        );
      } else if (
        (existingLease.status === 'terminated' || existingLease.status === 'expired') &&
        updates.status === 'active'
      ) {
        // Reactivating lease - check unit is available
        await validateUnitIsAvailable(existingLease.unitId, existingLease.organizationId);
        await updateUnit(existingLease.unitId, { status: 'occupied' as UnitStatus }).catch(
          (error) => {
            console.error('Failed to update unit status:', error);
          },
        );
      }
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // Convert date strings to Date objects if present
    if (updateDoc.startDate && typeof updateDoc.startDate === 'string') {
      updateDoc.startDate = new Date(updateDoc.startDate);
    }
    if (updateDoc.endDate !== undefined) {
      if (updateDoc.endDate && typeof updateDoc.endDate === 'string') {
        updateDoc.endDate = new Date(updateDoc.endDate);
      }
    }
    if (updateDoc.terminationDate && typeof updateDoc.terminationDate === 'string') {
      updateDoc.terminationDate = new Date(updateDoc.terminationDate);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(leaseId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as Lease;
  } catch (error) {
    // Re-throw validation errors
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function terminateLease(leaseId: string, reason?: string): Promise<Lease | null> {
  const collection = await getLeasesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingLease = await findLeaseById(leaseId);
    if (!existingLease) {
      return null;
    }

    const now = new Date();

    // Update lease status to terminated
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(leaseId) } as Document,
      {
        $set: {
          status: 'terminated' as LeaseStatus,
          endDate: now,
          terminationDate: now,
          terminationReason: reason ?? null,
          updatedAt: now,
        },
      } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    // Update unit status back to available
    if (existingLease.status === 'active') {
      await updateUnit(existingLease.unitId, { status: 'available' as UnitStatus }).catch(
        (error) => {
          console.error('Failed to update unit status to available:', error);
        },
      );
    }

    return result as Lease;
  } catch {
    return null;
  }
}

export async function listLeases(query: Record<string, unknown> = {}): Promise<Lease[]> {
  const collection = await getLeasesCollection();

  return collection.find(query as Document).toArray();
}
