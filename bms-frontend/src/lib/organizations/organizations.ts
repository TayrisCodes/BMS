import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';

const ORGANIZATIONS_COLLECTION_NAME = 'organizations';

export interface Organization {
  _id: string;
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  settings?: {
    [key: string]: unknown;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getOrganizationsCollection(): Promise<Collection<Organization>> {
  const db = await getDb();
  return db.collection<Organization>(ORGANIZATIONS_COLLECTION_NAME);
}

export async function ensureOrganizationIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(ORGANIZATIONS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Unique index on code
    {
      key: { code: 1 },
      unique: true,
      name: 'unique_code',
    },
  ];

  await collection.createIndexes(indexes);
}

export async function findOrganizationById(organizationId: string): Promise<Organization | null> {
  const collection = await getOrganizationsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    return collection.findOne({ _id: new ObjectId(organizationId) } as Document);
  } catch {
    return null;
  }
}

export async function findOrganizationByCode(code: string): Promise<Organization | null> {
  const collection = await getOrganizationsCollection();
  return collection.findOne({ code: code.trim() } as Document);
}

export interface CreateOrganizationInput {
  name: string;
  code: string;
  contactInfo?: Organization['contactInfo'];
  settings?: Organization['settings'];
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const collection = await getOrganizationsCollection();
  const now = new Date();

  const doc: Omit<Organization, '_id'> = {
    name: input.name.trim(),
    code: input.code.trim(),
    contactInfo: input.contactInfo ?? null,
    settings: input.settings ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Organization>);

  return {
    ...(doc as Organization),
    _id: result.insertedId.toString(),
  } as Organization;
}
