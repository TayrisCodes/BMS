import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findTenantById } from '@/lib/tenants/tenants';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';
import crypto from 'crypto';

const VISITOR_QR_CODES_COLLECTION_NAME = 'visitorQRCodes';

export interface VisitorQRCode {
  _id: string;
  organizationId: string;
  tenantId: string; // ObjectId ref to tenants (who generated the QR)
  buildingId: string; // ObjectId ref to buildings
  unitId?: string | null; // ObjectId ref to units
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  validFrom: Date; // QR code valid from this time
  validUntil: Date; // QR code expires at this time
  qrCode: string; // Unique QR code string/token
  used: boolean; // Whether QR code has been used to log entry
  usedAt?: Date | null; // When QR code was used
  visitorLogId?: string | null; // ObjectId ref to visitorLogs (if used)
  createdAt: Date;
  updatedAt: Date;
}

export async function getVisitorQRCodesCollection(): Promise<Collection<VisitorQRCode>> {
  const db = await getDb();
  return db.collection<VisitorQRCode>(VISITOR_QR_CODES_COLLECTION_NAME);
}

export async function ensureVisitorQRCodeIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(VISITOR_QR_CODES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Index on QR code string for fast lookup
    {
      key: { qrCode: 1 },
      unique: true,
      name: 'qrCode_unique',
    },
    // Index on tenantId and createdAt
    {
      key: { tenantId: 1, createdAt: -1 },
      name: 'tenantId_createdAt',
    },
    // Index on validUntil for cleanup queries
    {
      key: { validUntil: 1 },
      name: 'validUntil',
    },
    // Index on used status
    {
      key: { used: 1 },
      name: 'used',
    },
    // Compound index for validation queries
    {
      key: { qrCode: 1, used: 1, validUntil: 1 },
      name: 'qrCode_used_validUntil',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Generate a unique QR code token.
 */
function generateQRCodeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface CreateVisitorQRCodeInput {
  organizationId: string;
  tenantId: string;
  buildingId: string;
  unitId?: string | null;
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  validFrom?: Date;
  validUntil: Date; // Required - when QR code expires
}

export async function createVisitorQRCode(input: CreateVisitorQRCodeInput): Promise<VisitorQRCode> {
  const collection = await getVisitorQRCodesCollection();
  const now = new Date();

  // Validate tenant exists and belongs to same org
  const tenant = await findTenantById(input.tenantId, input.organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  if (tenant.organizationId !== input.organizationId) {
    throw new Error('Tenant does not belong to the same organization');
  }

  // Validate building exists and belongs to same org
  const building = await findBuildingById(input.buildingId, input.organizationId);
  if (!building) {
    throw new Error('Building not found');
  }
  if (building.organizationId !== input.organizationId) {
    throw new Error('Building does not belong to the same organization');
  }

  // Validate unit if provided
  if (input.unitId) {
    const unit = await findUnitById(input.unitId, input.organizationId);
    if (!unit) {
      throw new Error('Unit not found');
    }
    if (unit.organizationId !== input.organizationId) {
      throw new Error('Unit does not belong to the same organization');
    }
  }

  // Validate required fields
  if (!input.visitorName || !input.purpose || !input.validUntil) {
    throw new Error('visitorName, purpose, and validUntil are required');
  }

  // Validate validUntil is in the future
  if (input.validUntil <= now) {
    throw new Error('validUntil must be in the future');
  }

  // Validate validFrom if provided
  const validFrom = input.validFrom || now;
  if (validFrom >= input.validUntil) {
    throw new Error('validUntil must be after validFrom');
  }

  // Generate unique QR code token
  let qrCode = generateQRCodeToken();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure QR code is unique
  while (attempts < maxAttempts) {
    const existing = await collection.findOne({ qrCode } as Document);
    if (!existing) {
      break;
    }
    qrCode = generateQRCodeToken();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique QR code');
  }

  const doc: Omit<VisitorQRCode, '_id'> = {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    buildingId: input.buildingId,
    unitId: input.unitId ?? null,
    visitorName: input.visitorName.trim(),
    visitorPhone: input.visitorPhone?.trim() ?? null,
    visitorIdNumber: input.visitorIdNumber?.trim() ?? null,
    purpose: input.purpose.trim(),
    vehiclePlateNumber: input.vehiclePlateNumber?.trim().toUpperCase() ?? null,
    validFrom,
    validUntil: input.validUntil,
    qrCode,
    used: false,
    usedAt: null,
    visitorLogId: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<VisitorQRCode>);

  return {
    ...(doc as VisitorQRCode),
    _id: result.insertedId.toString(),
  } as VisitorQRCode;
}

export async function findVisitorQRCodeByCode(qrCode: string): Promise<VisitorQRCode | null> {
  const collection = await getVisitorQRCodesCollection();

  return collection.findOne({ qrCode } as Document);
}

export async function findVisitorQRCodesByTenant(
  tenantId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<VisitorQRCode[]> {
  const collection = await getVisitorQRCodesCollection();

  const query: Record<string, unknown> = {
    tenantId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ createdAt: -1 })
    .toArray();
}

export async function markQRCodeAsUsed(
  qrCodeId: string,
  visitorLogId: string,
): Promise<VisitorQRCode | null> {
  const collection = await getVisitorQRCodesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(qrCodeId) } as Document,
      {
        $set: {
          used: true,
          usedAt: new Date(),
          visitorLogId,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as VisitorQRCode | null;
  } catch {
    return null;
  }
}

/**
 * Validate a QR code and return the QR code data if valid.
 * Returns null if invalid, expired, or already used.
 */
export async function validateVisitorQRCode(qrCode: string): Promise<VisitorQRCode | null> {
  const collection = await getVisitorQRCodesCollection();
  const now = new Date();

  const qrCodeDoc = await collection.findOne({ qrCode } as Document);

  if (!qrCodeDoc) {
    return null; // QR code not found
  }

  // Check if already used
  if (qrCodeDoc.used) {
    return null; // Already used
  }

  // Check if expired
  if (now > qrCodeDoc.validUntil) {
    return null; // Expired
  }

  // Check if not yet valid
  if (now < qrCodeDoc.validFrom) {
    return null; // Not yet valid
  }

  return qrCodeDoc;
}
