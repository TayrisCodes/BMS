import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findMeterById } from '@/lib/meters/meters';

const UTILITY_PAYMENTS_COLLECTION_NAME = 'utilityPayments';

export type UtilityType = 'electricity' | 'water' | 'gas';

export interface UtilityPayment {
  _id: string;
  organizationId: string;
  meterId: string; // ObjectId ref to meters
  utilityType: UtilityType;
  periodStart: Date;
  periodEnd: Date;
  amount: number; // Payment amount in ETB
  paymentDate: Date;
  paymentMethod: string;
  receiptUrl?: string | null; // File storage path/URL
  receiptFileName?: string | null;
  notes?: string | null;
  createdBy?: string | null; // ObjectId ref to users
  createdAt: Date;
  updatedAt: Date;
}

export async function getUtilityPaymentsCollection(): Promise<Collection<UtilityPayment>> {
  const db = await getDb();
  return db.collection<UtilityPayment>(UTILITY_PAYMENTS_COLLECTION_NAME);
}

export async function ensureUtilityPaymentIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(UTILITY_PAYMENTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, meterId, and paymentDate
    {
      key: { organizationId: 1, meterId: 1, paymentDate: -1 },
      name: 'org_meter_payment_date',
    },
    // Index on utilityType
    {
      key: { utilityType: 1 },
      name: 'utilityType',
    },
    // Index on paymentDate
    {
      key: { paymentDate: -1 },
      name: 'paymentDate',
    },
    // Index on periodStart and periodEnd for date range queries
    {
      key: { periodStart: -1, periodEnd: -1 },
      name: 'period_dates',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a meter exists and belongs to the same organization.
 */
async function validateMeterBelongsToOrg(meterId: string, organizationId: string): Promise<void> {
  const meter = await findMeterById(meterId, organizationId);
  if (!meter) {
    throw new Error('Meter not found');
  }
  if (meter.organizationId !== organizationId) {
    throw new Error('Meter does not belong to the same organization');
  }
}

export interface CreateUtilityPaymentInput {
  organizationId: string;
  meterId: string;
  utilityType: UtilityType;
  periodStart: Date | string;
  periodEnd: Date | string;
  amount: number;
  paymentDate: Date | string;
  paymentMethod: string;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export async function createUtilityPayment(
  input: CreateUtilityPaymentInput,
): Promise<UtilityPayment> {
  const collection = await getUtilityPaymentsCollection();
  const now = new Date();

  // Validate meter exists and belongs to same org
  await validateMeterBelongsToOrg(input.meterId, input.organizationId);

  const doc: Omit<UtilityPayment, '_id'> = {
    organizationId: input.organizationId,
    meterId: input.meterId,
    utilityType: input.utilityType,
    periodStart:
      typeof input.periodStart === 'string' ? new Date(input.periodStart) : input.periodStart,
    periodEnd: typeof input.periodEnd === 'string' ? new Date(input.periodEnd) : input.periodEnd,
    amount: input.amount,
    paymentDate:
      typeof input.paymentDate === 'string' ? new Date(input.paymentDate) : input.paymentDate,
    paymentMethod: input.paymentMethod,
    receiptUrl: input.receiptUrl ?? null,
    receiptFileName: input.receiptFileName ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<UtilityPayment>);

  return {
    ...(doc as UtilityPayment),
    _id: result.insertedId.toString(),
  } as UtilityPayment;
}

export async function findUtilityPaymentById(
  paymentId: string,
  organizationId?: string,
): Promise<UtilityPayment | null> {
  const collection = await getUtilityPaymentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(paymentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export interface ListUtilityPaymentsFilters {
  organizationId?: string;
  meterId?: string;
  utilityType?: UtilityType;
  startDate?: Date;
  endDate?: Date;
}

export async function listUtilityPayments(
  filters: ListUtilityPaymentsFilters = {},
): Promise<UtilityPayment[]> {
  const collection = await getUtilityPaymentsCollection();

  const query: Record<string, unknown> = {};

  if (filters.organizationId) {
    query.organizationId = filters.organizationId;
  }

  if (filters.meterId) {
    query.meterId = filters.meterId;
  }

  if (filters.utilityType) {
    query.utilityType = filters.utilityType;
  }

  if (filters.startDate || filters.endDate) {
    query.paymentDate = {};
    if (filters.startDate) {
      (query.paymentDate as Record<string, unknown>).$gte = filters.startDate;
    }
    if (filters.endDate) {
      (query.paymentDate as Record<string, unknown>).$lte = filters.endDate;
    }
  }

  return collection
    .find(query as Document)
    .sort({ paymentDate: -1 })
    .toArray();
}

export async function updateUtilityPayment(
  paymentId: string,
  updates: Partial<UtilityPayment>,
): Promise<UtilityPayment | null> {
  const collection = await getUtilityPaymentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingPayment = await findUtilityPaymentById(paymentId);
    if (!existingPayment) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Convert date strings to Date objects if present
    if (updateDoc.periodStart && typeof updateDoc.periodStart === 'string') {
      updateDoc.periodStart = new Date(updateDoc.periodStart);
    }
    if (updateDoc.periodEnd && typeof updateDoc.periodEnd === 'string') {
      updateDoc.periodEnd = new Date(updateDoc.periodEnd);
    }
    if (updateDoc.paymentDate && typeof updateDoc.paymentDate === 'string') {
      updateDoc.paymentDate = new Date(updateDoc.paymentDate);
    }

    // Remove fields that shouldn't be updated
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // If meterId is being updated, validate it
    if (updateDoc.meterId && updateDoc.meterId !== existingPayment.meterId) {
      await validateMeterBelongsToOrg(updateDoc.meterId as string, existingPayment.organizationId);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(paymentId) } as Document,
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result || null;
  } catch {
    return null;
  }
}

export async function deleteUtilityPayment(
  paymentId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getUtilityPaymentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(paymentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount === 1;
  } catch {
    return false;
  }
}
