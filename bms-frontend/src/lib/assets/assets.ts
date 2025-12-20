import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';

const ASSETS_COLLECTION_NAME = 'assets';

export type AssetType =
  | 'equipment'
  | 'furniture'
  | 'infrastructure'
  | 'vehicle'
  | 'appliance'
  | 'other';

export type AssetStatus = 'active' | 'maintenance' | 'retired' | 'disposed';

export interface Asset {
  _id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null; // Optional unit association
  name: string;
  description?: string | null;
  assetType: AssetType;
  status: AssetStatus;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  purchaseDate?: Date | null;
  purchasePrice?: number | null;
  currentValue?: number | null; // Depreciated value
  location?: string | null; // Physical location within building
  // Warranty tracking
  warranty?: {
    startDate?: Date | null;
    endDate?: Date | null;
    provider?: string | null;
    warrantyNumber?: string | null;
    terms?: string | null;
  } | null;
  // Enhanced depreciation tracking
  depreciation?: {
    method?: 'straight-line' | 'declining-balance' | null;
    usefulLifeYears?: number | null;
    annualDepreciation?: number | null;
    depreciationStartDate?: Date | null;
    accumulatedDepreciation?: number | null;
  } | null;
  // Additional fields
  installationDate?: Date | null;
  supplier?: string | null;
  supplierContact?: string | null;
  maintenanceSchedule?: {
    frequency?: string; // e.g., "monthly", "quarterly", "annually"
    lastMaintenanceDate?: Date | null;
    nextMaintenanceDate?: Date | null;
  } | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAssetsCollection(): Promise<Collection<Asset>> {
  const db = await getDb();
  return db.collection<Asset>(ASSETS_COLLECTION_NAME);
}

export async function ensureAssetIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(ASSETS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId and status
    {
      key: { organizationId: 1, status: 1 },
      name: 'org_status',
    },
    // Index on buildingId
    {
      key: { buildingId: 1 },
      name: 'buildingId',
    },
    // Sparse index on unitId
    {
      key: { unitId: 1 },
      sparse: true,
      name: 'unitId_sparse',
    },
    // Index on organizationId for general queries
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
    // Index on assetType
    {
      key: { assetType: 1 },
      name: 'assetType',
    },
    // Index on warranty endDate for expiration tracking
    {
      key: { 'warranty.endDate': 1 },
      sparse: true,
      name: 'warranty_endDate',
    },
    // Index on depreciation method
    {
      key: { 'depreciation.method': 1 },
      sparse: true,
      name: 'depreciation_method',
    },
  ];

  await collection.createIndexes(indexes);
}

export interface CreateAssetInput {
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  name: string;
  description?: string | null;
  assetType: AssetType;
  status?: AssetStatus;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  purchaseDate?: Date | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  location?: string | null;
  warranty?: Asset['warranty'];
  maintenanceSchedule?: Asset['maintenanceSchedule'];
  depreciation?: Asset['depreciation'];
  installationDate?: Date | null;
  supplier?: string | null;
  supplierContact?: string | null;
  notes?: string | null;
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const collection = await getAssetsCollection();
  const now = new Date();

  const doc: Omit<Asset, '_id'> = {
    organizationId: input.organizationId,
    buildingId: input.buildingId,
    unitId: input.unitId ?? null,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    assetType: input.assetType,
    status: input.status ?? 'active',
    serialNumber: input.serialNumber?.trim() ?? null,
    model: input.model?.trim() ?? null,
    manufacturer: input.manufacturer?.trim() ?? null,
    purchaseDate: input.purchaseDate ?? null,
    purchasePrice: input.purchasePrice ?? null,
    currentValue: input.currentValue ?? null,
    location: input.location?.trim() ?? null,
    warranty: input.warranty ?? null,
    maintenanceSchedule: input.maintenanceSchedule ?? null,
    depreciation: input.depreciation ?? null,
    installationDate: input.installationDate ?? null,
    supplier: input.supplier?.trim() ?? null,
    supplierContact: input.supplierContact?.trim() ?? null,
    notes: input.notes?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Asset>);

  return {
    ...(doc as Asset),
    _id: result.insertedId.toString(),
  } as Asset;
}

export async function findAssetById(
  assetId: string,
  organizationId?: string,
): Promise<Asset | null> {
  const collection = await getAssetsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(assetId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findAssetsByOrganization(
  organizationId: string,
  filters?: Record<string, unknown>,
): Promise<Asset[]> {
  const collection = await getAssetsCollection();

  const query: Record<string, unknown> = {
    organizationId,
    ...filters,
  };

  return collection.find(query as Document).toArray();
}

export async function findAssetsByBuilding(
  buildingId: string,
  organizationId?: string,
): Promise<Asset[]> {
  const collection = await getAssetsCollection();

  const query: Record<string, unknown> = {
    buildingId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.find(query as Document).toArray();
}

export async function updateAsset(assetId: string, updates: Partial<Asset>): Promise<Asset | null> {
  const collection = await getAssetsCollection();
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
    if (updateDoc.description && typeof updateDoc.description === 'string') {
      updateDoc.description = updateDoc.description.trim();
    }
    if (updateDoc.serialNumber && typeof updateDoc.serialNumber === 'string') {
      updateDoc.serialNumber = updateDoc.serialNumber.trim();
    }
    if (updateDoc.model && typeof updateDoc.model === 'string') {
      updateDoc.model = updateDoc.model.trim();
    }
    if (updateDoc.manufacturer && typeof updateDoc.manufacturer === 'string') {
      updateDoc.manufacturer = updateDoc.manufacturer.trim();
    }
    if (updateDoc.location && typeof updateDoc.location === 'string') {
      updateDoc.location = updateDoc.location.trim();
    }
    if (updateDoc.notes && typeof updateDoc.notes === 'string') {
      updateDoc.notes = updateDoc.notes.trim();
    }
    if (updateDoc.supplier && typeof updateDoc.supplier === 'string') {
      updateDoc.supplier = updateDoc.supplier.trim();
    }
    if (updateDoc.supplierContact && typeof updateDoc.supplierContact === 'string') {
      updateDoc.supplierContact = updateDoc.supplierContact.trim();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(assetId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as Asset;
  } catch {
    return null;
  }
}

export async function deleteAsset(assetId: string): Promise<boolean> {
  const collection = await getAssetsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Soft delete by setting status to disposed
    const result = await collection.updateOne(
      { _id: new ObjectId(assetId) } as Document,
      { $set: { status: 'disposed' as AssetStatus, updatedAt: new Date() } } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listAssets(query: Record<string, unknown> = {}): Promise<Asset[]> {
  const collection = await getAssetsCollection();

  return collection.find(query as Document).toArray();
}

/**
 * Depreciation calculation utilities
 */

/**
 * Calculates depreciation for an asset using straight-line method.
 */
export function calculateStraightLineDepreciation(
  purchasePrice: number,
  usefulLifeYears: number,
  depreciationStartDate: Date,
  asOfDate: Date = new Date(),
): { annualDepreciation: number; accumulatedDepreciation: number; currentValue: number } {
  if (usefulLifeYears <= 0) {
    throw new Error('Useful life must be greater than zero');
  }

  const annualDepreciation = purchasePrice / usefulLifeYears;
  const yearsElapsed =
    (asOfDate.getTime() - depreciationStartDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const accumulatedDepreciation = Math.min(annualDepreciation * yearsElapsed, purchasePrice);
  const currentValue = Math.max(purchasePrice - accumulatedDepreciation, 0);

  return {
    annualDepreciation,
    accumulatedDepreciation,
    currentValue,
  };
}

/**
 * Calculates depreciation for an asset using declining balance method.
 */
export function calculateDecliningBalanceDepreciation(
  purchasePrice: number,
  usefulLifeYears: number,
  depreciationStartDate: Date,
  depreciationRate: number = 2, // Default 200% (double declining balance)
  asOfDate: Date = new Date(),
): { annualDepreciation: number; accumulatedDepreciation: number; currentValue: number } {
  if (usefulLifeYears <= 0) {
    throw new Error('Useful life must be greater than zero');
  }

  const straightLineRate = 1 / usefulLifeYears;
  const decliningRate = straightLineRate * depreciationRate;
  const yearsElapsed =
    (asOfDate.getTime() - depreciationStartDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  let currentValue = purchasePrice;
  let accumulatedDepreciation = 0;

  for (let year = 0; year < Math.floor(yearsElapsed); year++) {
    const yearDepreciation = currentValue * decliningRate;
    accumulatedDepreciation += yearDepreciation;
    currentValue = Math.max(currentValue - yearDepreciation, 0);
  }

  // Calculate partial year if applicable
  const partialYear = yearsElapsed - Math.floor(yearsElapsed);
  if (partialYear > 0 && currentValue > 0) {
    const partialDepreciation = currentValue * decliningRate * partialYear;
    accumulatedDepreciation += partialDepreciation;
    currentValue = Math.max(currentValue - partialDepreciation, 0);
  }

  const annualDepreciation = purchasePrice * decliningRate;

  return {
    annualDepreciation,
    accumulatedDepreciation: Math.min(accumulatedDepreciation, purchasePrice),
    currentValue: Math.max(currentValue, 0),
  };
}

/**
 * Updates asset depreciation based on current date and depreciation method.
 */
export async function updateAssetDepreciation(
  assetId: string,
  asOfDate?: Date,
): Promise<Asset | null> {
  const asset = await findAssetById(assetId);
  if (!asset || !asset.depreciation || !asset.purchasePrice || !asset.purchaseDate) {
    return null;
  }

  const depreciation = asset.depreciation;
  if (!depreciation.method || !depreciation.usefulLifeYears) {
    return null;
  }

  const depreciationStartDate = depreciation.depreciationStartDate || asset.purchaseDate;
  const calculationDate = asOfDate || new Date();

  let result: { annualDepreciation: number; accumulatedDepreciation: number; currentValue: number };

  if (depreciation.method === 'straight-line') {
    result = calculateStraightLineDepreciation(
      asset.purchasePrice,
      depreciation.usefulLifeYears,
      depreciationStartDate,
      calculationDate,
    );
  } else if (depreciation.method === 'declining-balance') {
    result = calculateDecliningBalanceDepreciation(
      asset.purchasePrice,
      depreciation.usefulLifeYears,
      depreciationStartDate,
      2, // Default 200% declining balance
      calculationDate,
    );
  } else {
    return null;
  }

  return updateAsset(assetId, {
    depreciation: {
      ...depreciation,
      annualDepreciation: result.annualDepreciation,
      depreciationStartDate: depreciationStartDate,
      accumulatedDepreciation: result.accumulatedDepreciation,
    },
    currentValue: result.currentValue,
  });
}
