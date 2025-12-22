import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';

const PARKING_PRICING_COLLECTION_NAME = 'parkingPricing';

export type ParkingSpaceType = 'tenant' | 'visitor';
export type PricingModel = 'monthly' | 'daily' | 'hourly';

export interface ParkingPricing {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  spaceType: ParkingSpaceType;
  pricingModel: PricingModel;
  monthlyRate?: number | null; // For tenant monthly parking
  dailyRate?: number | null; // For visitor daily parking
  hourlyRate?: number | null; // For visitor hourly parking
  currency: string; // 'ETB'
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getParkingPricingCollection(): Promise<Collection<ParkingPricing>> {
  const db = await getDb();
  return db.collection<ParkingPricing>(PARKING_PRICING_COLLECTION_NAME);
}

export async function ensureParkingPricingIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PARKING_PRICING_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, buildingId, spaceType, and isActive
    {
      key: { organizationId: 1, buildingId: 1, spaceType: 1, isActive: 1 },
      name: 'org_building_spaceType_active',
    },
    // Index on effectiveFrom and effectiveTo for date range queries
    {
      key: { effectiveFrom: -1, effectiveTo: 1 },
      name: 'effective_dates',
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

export interface CreateParkingPricingInput {
  organizationId: string;
  buildingId: string;
  spaceType: ParkingSpaceType;
  pricingModel: PricingModel;
  monthlyRate?: number | null;
  dailyRate?: number | null;
  hourlyRate?: number | null;
  currency?: string;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  isActive?: boolean;
}

export async function createParkingPricing(
  input: CreateParkingPricingInput,
): Promise<ParkingPricing> {
  const collection = await getParkingPricingCollection();
  const now = new Date();

  // Validate building exists and belongs to same org
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate pricing model matches rates
  if (input.spaceType === 'tenant' && input.pricingModel === 'monthly' && !input.monthlyRate) {
    throw new Error('Monthly rate is required for tenant monthly parking');
  }
  if (input.spaceType === 'visitor') {
    if (input.pricingModel === 'daily' && !input.dailyRate) {
      throw new Error('Daily rate is required for visitor daily parking');
    }
    if (input.pricingModel === 'hourly' && !input.hourlyRate) {
      throw new Error('Hourly rate is required for visitor hourly parking');
    }
  }

  const doc: Omit<ParkingPricing, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    spaceType: input.spaceType,
    pricingModel: input.pricingModel,
    monthlyRate: input.monthlyRate ?? null,
    dailyRate: input.dailyRate ?? null,
    hourlyRate: input.hourlyRate ?? null,
    currency: input.currency || 'ETB',
    effectiveFrom:
      typeof input.effectiveFrom === 'string' ? new Date(input.effectiveFrom) : input.effectiveFrom,
    effectiveTo:
      input.effectiveTo && typeof input.effectiveTo === 'string'
        ? new Date(input.effectiveTo)
        : input.effectiveTo || null,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<ParkingPricing>);

  return {
    ...(doc as ParkingPricing),
    _id: result.insertedId.toString(),
  } as ParkingPricing;
}

export async function findParkingPricingById(
  pricingId: string,
  organizationId?: string,
): Promise<ParkingPricing | null> {
  const collection = await getParkingPricingCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(pricingId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findActivePricing(
  buildingId: string,
  spaceType: ParkingSpaceType,
  organizationId?: string,
  date?: Date,
): Promise<ParkingPricing | null> {
  const collection = await getParkingPricingCollection();
  const checkDate = date || new Date();

  const query: Record<string, unknown> = {
    buildingId,
    spaceType,
    isActive: true,
    effectiveFrom: { $lte: checkDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: checkDate } }],
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  // Find the most recent active pricing
  return collection.findOne(query as Document, {
    sort: { effectiveFrom: -1 },
  });
}

export interface ListParkingPricingFilters {
  organizationId?: string;
  buildingId?: string;
  spaceType?: ParkingSpaceType;
  isActive?: boolean;
}

export async function listParkingPricing(
  filters: ListParkingPricingFilters = {},
): Promise<ParkingPricing[]> {
  const collection = await getParkingPricingCollection();

  const query: Record<string, unknown> = {};

  if (filters.organizationId) {
    query.organizationId = filters.organizationId;
  }

  if (filters.buildingId) {
    query.buildingId = filters.buildingId;
  }

  if (filters.spaceType) {
    query.spaceType = filters.spaceType;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  return collection
    .find(query as Document)
    .sort({ effectiveFrom: -1 })
    .toArray();
}

export async function updateParkingPricing(
  pricingId: string,
  updates: Partial<ParkingPricing>,
): Promise<ParkingPricing | null> {
  const collection = await getParkingPricingCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingPricing = await findParkingPricingById(pricingId);
    if (!existingPricing) {
      return null;
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Convert date strings to Date objects if present
    if (updateDoc.effectiveFrom && typeof updateDoc.effectiveFrom === 'string') {
      updateDoc.effectiveFrom = new Date(updateDoc.effectiveFrom);
    }
    if (updateDoc.effectiveTo && typeof updateDoc.effectiveTo === 'string') {
      updateDoc.effectiveTo = new Date(updateDoc.effectiveTo);
    }

    // Remove fields that shouldn't be updated
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // If buildingId is being updated, validate it
    if (updateDoc.buildingId && updateDoc.buildingId !== existingPricing.buildingId) {
      await validateBuildingBelongsToOrg(
        updateDoc.buildingId as string,
        existingPricing.organizationId,
      );
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(pricingId) },
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result || null;
  } catch {
    return null;
  }
}

export async function deleteParkingPricing(
  pricingId: string,
  organizationId?: string,
): Promise<boolean> {
  const collection = await getParkingPricingCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(pricingId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const result = await collection.deleteOne(query as Document);
    return result.deletedCount === 1;
  } catch {
    return false;
  }
}
