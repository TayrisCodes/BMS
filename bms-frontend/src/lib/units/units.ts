import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findBuildingById } from '@/lib/buildings/buildings';

const UNITS_COLLECTION_NAME = 'units';

export type UnitType = 'apartment' | 'office' | 'shop' | 'warehouse' | 'parking';
export type UnitStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';

export interface Unit {
  _id: string;
  organizationId: string;
  buildingId: string; // ObjectId ref to buildings
  unitNumber: string; // e.g., "A-101"
  floor?: number | null;
  unitType: UnitType;
  area?: number | null; // square meters
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: UnitStatus;
  rentAmount?: number | null; // legacy/base rent in ETB
  ratePerSqmOverride?: number | null;
  flatRentOverride?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getUnitsCollection(): Promise<Collection<Unit>> {
  const db = await getDb();
  return db.collection<Unit>(UNITS_COLLECTION_NAME);
}

export async function ensureUnitIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(UNITS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound unique index on buildingId and unitNumber (unit number unique per building)
    {
      key: { buildingId: 1, unitNumber: 1 },
      unique: true,
      name: 'unique_building_unit_number',
    },
    // Compound index on organizationId, buildingId, and status
    {
      key: { organizationId: 1, buildingId: 1, status: 1 },
      name: 'org_building_status',
    },
    // Index on buildingId
    {
      key: { buildingId: 1 },
      name: 'buildingId',
    },
    // Index on organizationId
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
  ];

  await collection.createIndexes(indexes);
}

export interface CreateUnitInput {
  organizationId: string;
  buildingId: string;
  unitNumber: string;
  floor?: number | null;
  unitType: UnitType;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status?: UnitStatus;
  rentAmount?: number | null;
}

/**
 * Validates that a building belongs to the same organization.
 * Throws an error if validation fails.
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
 * Validates that a unit number is unique within a building.
 * Returns true if unique, false if duplicate exists.
 */
async function isUnitNumberUniqueInBuilding(
  buildingId: string,
  unitNumber: string,
  excludeUnitId?: string,
): Promise<boolean> {
  const collection = await getUnitsCollection();
  const { ObjectId } = await import('mongodb');

  const query: Record<string, unknown> = {
    buildingId,
    unitNumber: unitNumber.trim(),
  };

  if (excludeUnitId) {
    query._id = { $ne: new ObjectId(excludeUnitId) };
  }

  const existing = await collection.findOne(query as Document);
  return existing === null;
}

export async function createUnit(input: CreateUnitInput): Promise<Unit> {
  const collection = await getUnitsCollection();
  const now = new Date();

  // Validate building belongs to same organization
  await validateBuildingBelongsToOrg(input.buildingId, input.organizationId);

  // Validate unit number is unique within building
  const isUnique = await isUnitNumberUniqueInBuilding(input.buildingId, input.unitNumber);
  if (!isUnique) {
    throw new Error(`Unit number "${input.unitNumber}" already exists in this building`);
  }

  const doc: Omit<Unit, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    unitNumber: input.unitNumber.trim(),
    floor: input.floor ?? null,
    unitType: input.unitType,
    area: input.area ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    status: input.status ?? 'available',
    rentAmount: input.rentAmount ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Unit>);

  return {
    ...(doc as Unit),
    _id: result.insertedId.toString(),
  } as Unit;
}

export async function findUnitById(unitId: string, organizationId?: string): Promise<Unit | null> {
  const collection = await getUnitsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(unitId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findUnitsByBuilding(
  buildingId: string,
  filters?: Record<string, unknown>,
): Promise<Unit[]> {
  const collection = await getUnitsCollection();

  const query: Record<string, unknown> = {
    buildingId,
    ...filters,
  };

  return collection.find(query as Document).toArray();
}

export async function updateUnit(unitId: string, updates: Partial<Unit>): Promise<Unit | null> {
  const collection = await getUnitsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // If buildingId or unitNumber is being updated, validate
    if (updates.buildingId || updates.unitNumber) {
      const existingUnit = await findUnitById(unitId);
      if (!existingUnit) {
        return null;
      }

      const newBuildingId = updates.buildingId ?? existingUnit.buildingId;
      const newUnitNumber = updates.unitNumber ?? existingUnit.unitNumber;

      // Validate building belongs to same organization
      if (updates.buildingId && updates.buildingId !== existingUnit.buildingId) {
        await validateBuildingBelongsToOrg(newBuildingId, existingUnit.organizationId);
      }

      // Validate unit number is unique within building
      if (
        (updates.unitNumber && updates.unitNumber !== existingUnit.unitNumber) ||
        (updates.buildingId && updates.buildingId !== existingUnit.buildingId)
      ) {
        const isUnique = await isUnitNumberUniqueInBuilding(newBuildingId, newUnitNumber, unitId);
        if (!isUnique) {
          throw new Error(`Unit number "${newUnitNumber}" already exists in this building`);
        }
      }
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;

    // Trim string fields if present
    if (updateDoc.unitNumber && typeof updateDoc.unitNumber === 'string') {
      updateDoc.unitNumber = updateDoc.unitNumber.trim();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(unitId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as Unit;
  } catch (error) {
    // Re-throw validation errors
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function deleteUnit(unitId: string): Promise<boolean> {
  const collection = await getUnitsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // TODO: Check if unit has active lease before deleting
    // For now, just soft delete (set status to unavailable or remove)
    // Since we don't have leases yet, we'll set status to a non-active state
    const result = await collection.updateOne(
      { _id: new ObjectId(unitId) } as Document,
      {
        $set: {
          status: 'maintenance' as UnitStatus,
          updatedAt: new Date(),
        },
      } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listUnits(query: Record<string, unknown> = {}): Promise<Unit[]> {
  const collection = await getUnitsCollection();

  return collection.find(query as Document).toArray();
}
