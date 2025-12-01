import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';

const BUILDINGS_COLLECTION_NAME = 'buildings';

export type BuildingType = 'residential' | 'commercial' | 'mixed';
export type BuildingStatus = 'active' | 'under-construction' | 'inactive';

export interface Building {
  _id: string;
  organizationId: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
  buildingType: BuildingType;
  totalFloors?: number | null;
  totalUnits?: number | null; // Computed or manual
  status: BuildingStatus;
  managerId?: string | null; // ObjectId ref to users
  settings?: {
    parkingSpaces?: number;
    amenities?: string[];
    [key: string]: unknown;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getBuildingsCollection(): Promise<Collection<Building>> {
  const db = await getDb();
  return db.collection<Building>(BUILDINGS_COLLECTION_NAME);
}

export async function ensureBuildingIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(BUILDINGS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId and status
    {
      key: { organizationId: 1, status: 1 },
      name: 'org_status',
    },
    // Sparse index on managerId
    {
      key: { managerId: 1 },
      sparse: true,
      name: 'managerId_sparse',
    },
    // Index on organizationId for general queries
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
  ];

  await collection.createIndexes(indexes);
}

export interface CreateBuildingInput {
  organizationId: string;
  name: string;
  address?: Building['address'];
  buildingType: BuildingType;
  totalFloors?: number | null;
  totalUnits?: number | null;
  status?: BuildingStatus;
  managerId?: string | null;
  settings?: Building['settings'];
}

export async function createBuilding(input: CreateBuildingInput): Promise<Building> {
  const collection = await getBuildingsCollection();
  const now = new Date();

  const doc: Omit<Building, '_id'> = {
    organizationId: input.organizationId,
    name: input.name.trim(),
    address: input.address ?? null,
    buildingType: input.buildingType,
    totalFloors: input.totalFloors ?? null,
    totalUnits: input.totalUnits ?? null,
    status: input.status ?? 'active',
    managerId: input.managerId ?? null,
    settings: input.settings ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Building>);

  return {
    ...(doc as Building),
    _id: result.insertedId.toString(),
  } as Building;
}

export async function findBuildingById(
  buildingId: string,
  organizationId?: string,
): Promise<Building | null> {
  const collection = await getBuildingsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(buildingId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findBuildingsByOrganization(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<Building[]> {
  const collection = await getBuildingsCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection.find(query as Document).toArray();
}

export async function updateBuilding(
  buildingId: string,
  updates: Partial<Building>,
): Promise<Building | null> {
  const collection = await getBuildingsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;

    // Trim string fields if present
    if (updateDoc.name && typeof updateDoc.name === 'string') {
      updateDoc.name = updateDoc.name.trim();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(buildingId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as Building;
  } catch {
    return null;
  }
}

export async function deleteBuilding(buildingId: string): Promise<boolean> {
  const collection = await getBuildingsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // TODO: Check if building has active leases before deleting
    // For now, just soft delete (set status to inactive)
    const result = await collection.updateOne(
      { _id: new ObjectId(buildingId) } as Document,
      { $set: { status: 'inactive' as BuildingStatus, updatedAt: new Date() } } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listBuildings(query: Record<string, unknown> = {}): Promise<Building[]> {
  const collection = await getBuildingsCollection();

  return collection.find(query as Document).toArray();
}
