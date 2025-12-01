import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';

const METERS_COLLECTION_NAME = 'meters';

export type MeterType = 'electricity' | 'water' | 'gas';
export type MeterUnit = 'kwh' | 'cubic_meter' | 'liter';
export type MeterStatus = 'active' | 'inactive' | 'faulty';

export interface Meter {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  unitId?: string | null; // ObjectId ref to units (optional, null for building-level meters)
  assetId?: string | null; // ObjectId ref to assets (optional)
  meterType: MeterType;
  meterNumber: string; // Unique per org
  unit: MeterUnit;
  installationDate: Date;
  status: MeterStatus;
  lastReading?: number | null;
  lastReadingDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getMetersCollection(): Promise<Collection<Meter>> {
  const db = await getDb();
  return db.collection<Meter>(METERS_COLLECTION_NAME);
}

export async function ensureMeterIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(METERS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound unique index on organizationId and meterNumber
    {
      key: { organizationId: 1, meterNumber: 1 },
      unique: true,
      name: 'unique_org_meter_number',
    },
    // Compound index on organizationId, buildingId, and meterType
    {
      key: { organizationId: 1, buildingId: 1, meterType: 1 },
      name: 'org_building_meter_type',
    },
    // Sparse index on unitId
    {
      key: { unitId: 1 },
      sparse: true,
      name: 'unitId_sparse',
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
 * Validates that a unit exists and belongs to the same organization (if provided).
 */
async function validateUnitBelongsToOrg(
  unitId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!unitId) {
    return; // Unit is optional
  }

  const unit = await findUnitById(unitId, organizationId);
  if (!unit) {
    throw new Error('Unit not found');
  }
  if (unit.organizationId !== organizationId) {
    throw new Error('Unit does not belong to the same organization');
  }
}

export interface CreateMeterInput {
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  assetId?: string | null;
  meterType: MeterType;
  meterNumber: string;
  unit: MeterUnit;
  installationDate: Date;
  status?: MeterStatus;
  lastReading?: number | null;
  lastReadingDate?: Date | null;
}

export async function createMeter(input: CreateMeterInput): Promise<Meter> {
  const collection = await getMetersCollection();
  const now = new Date();

  // Validate building exists and belongs to same org
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate unit if provided
  await validateUnitBelongsToOrg(input.unitId, input.organizationId);

  // Validate required fields
  if (!input.meterType || !input.meterNumber || !input.unit) {
    throw new Error('meterType, meterNumber, and unit are required');
  }

  // Validate meter number uniqueness (will be enforced by unique index, but check early for better error)
  const existingMeter = await collection.findOne({
    organizationId: input.organizationId,
    meterNumber: input.meterNumber.trim(),
  } as Document);

  if (existingMeter) {
    throw new Error('Meter number already exists in this organization');
  }

  const doc: Omit<Meter, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    unitId: input.unitId ?? null,
    assetId: input.assetId ?? null,
    meterType: input.meterType,
    meterNumber: input.meterNumber.trim(),
    unit: input.unit,
    installationDate: input.installationDate,
    status: input.status ?? 'active',
    lastReading: input.lastReading ?? null,
    lastReadingDate: input.lastReadingDate ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Meter>);

  return {
    ...(doc as Meter),
    _id: result.insertedId.toString(),
  } as Meter;
}

export async function findMeterById(
  meterId: string,
  organizationId?: string,
): Promise<Meter | null> {
  const collection = await getMetersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(meterId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findMetersByBuilding(
  buildingId: string,
  organizationId?: string,
): Promise<Meter[]> {
  const collection = await getMetersCollection();

  const query: Record<string, unknown> = {
    buildingId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ meterType: 1, meterNumber: 1 })
    .toArray();
}

export async function findMetersByUnit(unitId: string, organizationId?: string): Promise<Meter[]> {
  const collection = await getMetersCollection();

  const query: Record<string, unknown> = {
    unitId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ meterType: 1, meterNumber: 1 })
    .toArray();
}

export async function updateMeter(meterId: string, updates: Partial<Meter>): Promise<Meter | null> {
  const collection = await getMetersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingMeter = await findMeterById(meterId);
    if (!existingMeter) {
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
    if (updateDoc.meterNumber && typeof updateDoc.meterNumber === 'string') {
      updateDoc.meterNumber = updateDoc.meterNumber.trim();
    }

    // Validate building if being updated
    if (updateDoc.buildingId !== undefined && updateDoc.buildingId !== existingMeter.buildingId) {
      await validateBuildingBelongsToOrg(
        updateDoc.buildingId as string,
        existingMeter.organizationId,
      );
    }

    // Validate unit if being updated
    if (updateDoc.unitId !== undefined && updateDoc.unitId !== existingMeter.unitId) {
      await validateUnitBelongsToOrg(
        updateDoc.unitId as string | null,
        existingMeter.organizationId,
      );
    }

    // Validate meter number uniqueness if being updated
    if (
      updateDoc.meterNumber !== undefined &&
      updateDoc.meterNumber !== existingMeter.meterNumber
    ) {
      const existingMeterWithNumber = await collection.findOne({
        organizationId: existingMeter.organizationId,
        meterNumber: updateDoc.meterNumber as string,
        _id: { $ne: new ObjectId(meterId) },
      } as Document);

      if (existingMeterWithNumber) {
        throw new Error('Meter number already exists in this organization');
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(meterId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Meter | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteMeter(meterId: string): Promise<boolean> {
  const collection = await getMetersCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Soft delete: set status to inactive
    const result = await collection.updateOne(
      { _id: new ObjectId(meterId) } as Document,
      { $set: { status: 'inactive' as MeterStatus, updatedAt: new Date() } } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listMeters(query: Record<string, unknown> = {}): Promise<Meter[]> {
  const collection = await getMetersCollection();

  return collection
    .find(query as Document)
    .sort({ meterType: 1, meterNumber: 1 })
    .toArray();
}
