import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';

const TENANTS_COLLECTION_NAME = 'tenants';

export type TenantLanguage = 'am' | 'en' | 'om' | 'ti' | null;
export type TenantStatus = 'active' | 'inactive' | 'suspended';

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  emailTypes: string[]; // Notification types to receive via email
  smsTypes: string[]; // Notification types to receive via SMS
}

export interface Tenant {
  _id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email?: string | null;
  nationalId?: string | null;
  language: TenantLanguage;
  status: TenantStatus;
  emergencyContact?: {
    name: string;
    phone: string;
  } | null;
  notes?: string | null;
  notificationPreferences?: NotificationPreferences | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTenantsCollection(): Promise<Collection<Tenant>> {
  const db = await getDb();
  return db.collection<Tenant>(TENANTS_COLLECTION_NAME);
}

export async function ensureTenantIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(TENANTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound unique index on organizationId and primaryPhone
    {
      key: { organizationId: 1, primaryPhone: 1 },
      unique: true,
      name: 'unique_org_phone',
    },
    // Compound index on organizationId and status
    {
      key: { organizationId: 1, status: 1 },
      name: 'org_status',
    },
    // Sparse index on primaryPhone for OTP lookup
    {
      key: { primaryPhone: 1 },
      sparse: true,
      name: 'primaryPhone_sparse',
    },
  ];

  await collection.createIndexes(indexes);
}

export async function findTenantByPhone(
  phone: string,
  organizationId?: string,
): Promise<Tenant | null> {
  const collection = await getTenantsCollection();
  const query: Record<string, unknown> = { primaryPhone: phone.trim() };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

export interface CreateTenantInput {
  organizationId: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email?: string | null;
  nationalId?: string | null;
  language?: TenantLanguage;
  status?: TenantStatus;
  emergencyContact?: Tenant['emergencyContact'];
  notes?: string | null;
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const collection = await getTenantsCollection();
  const now = new Date();

  const doc: Omit<Tenant, '_id'> = {
    organizationId: input.organizationId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    primaryPhone: input.primaryPhone.trim(),
    email: input.email !== undefined ? input.email : null,
    nationalId: input.nationalId !== undefined ? input.nationalId : null,
    language: input.language ?? null,
    status: input.status ?? 'active',
    emergencyContact: input.emergencyContact ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Tenant>);

  return {
    ...(doc as Tenant),
    _id: result.insertedId.toString(),
  } as Tenant;
}

export async function findTenantById(
  tenantId: string,
  organizationId?: string,
): Promise<Tenant | null> {
  const collection = await getTenantsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(tenantId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<Tenant>,
): Promise<Tenant | null> {
  const collection = await getTenantsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove _id from updates if present
    delete updateDoc._id;

    // Trim string fields if present
    if (updateDoc.firstName && typeof updateDoc.firstName === 'string') {
      updateDoc.firstName = updateDoc.firstName.trim();
    }
    if (updateDoc.lastName && typeof updateDoc.lastName === 'string') {
      updateDoc.lastName = updateDoc.lastName.trim();
    }
    if (updateDoc.primaryPhone && typeof updateDoc.primaryPhone === 'string') {
      updateDoc.primaryPhone = updateDoc.primaryPhone.trim();
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(tenantId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    return result as Tenant;
  } catch {
    return null;
  }
}

export async function deleteTenant(tenantId: string): Promise<boolean> {
  const collection = await getTenantsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const result = await collection.updateOne(
      { _id: new ObjectId(tenantId) } as Document,
      { $set: { status: 'inactive' as TenantStatus, updatedAt: new Date() } } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listTenants(query: Record<string, unknown> = {}): Promise<Tenant[]> {
  const collection = await getTenantsCollection();

  return collection.find(query as Document).toArray();
}
