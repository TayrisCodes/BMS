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
  subscriptionId?: string | null; // Reference to active subscription
  status?: 'active' | 'inactive' | 'suspended' | null;
  // Domain/subdomain support
  domain?: string | null; // Custom domain (e.g., "acme.com")
  subdomain?: string | null; // Subdomain (e.g., "acme" for acme.bms.com)
  // Branding and customization
  branding?: {
    logo?: string | null; // URL to logo image
    primaryColor?: string | null; // Hex color code
    secondaryColor?: string | null; // Hex color code
    favicon?: string | null; // URL to favicon
    companyName?: string | null; // Display name (can differ from legal name)
    tagline?: string | null;
  } | null;
  // Payment reminder settings
  paymentReminderSettings?: {
    daysBeforeDue: number[]; // e.g., [7, 3, 0] - send reminders 7 days, 3 days, and on due date
    daysAfterDue: number[]; // e.g., [3, 7, 14, 30] - send reminders 3, 7, 14, 30 days after due
    escalationEnabled: boolean; // Enable daily reminders after due date
    reminderChannels: ('in_app' | 'email' | 'sms')[]; // Channels to send reminders
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
    // Unique index on subdomain
    {
      key: { subdomain: 1 },
      unique: true,
      sparse: true, // Allow null values
      name: 'unique_subdomain',
    },
    // Unique index on domain
    {
      key: { domain: 1 },
      unique: true,
      sparse: true, // Allow null values
      name: 'unique_domain',
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

export async function findOrganizationBySubdomain(subdomain: string): Promise<Organization | null> {
  const collection = await getOrganizationsCollection();
  return collection.findOne({ subdomain: subdomain.trim().toLowerCase() } as Document);
}

export async function findOrganizationByDomain(domain: string): Promise<Organization | null> {
  const collection = await getOrganizationsCollection();
  return collection.findOne({ domain: domain.trim().toLowerCase() } as Document);
}

export interface CreateOrganizationInput {
  name: string;
  code?: string; // Optional - will be auto-generated if not provided
  contactInfo?: Organization['contactInfo'];
  settings?: Organization['settings'];
  subscriptionId?: string | null;
  domain?: string | null;
  subdomain?: string | null;
  branding?: Organization['branding'];
}

/**
 * Generate a unique organization code from the organization name
 */
export function generateOrganizationCode(name: string): string {
  // Convert to uppercase, remove special characters, replace spaces with hyphens
  let code = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 30); // Limit length

  // If empty, use a default
  if (!code) {
    code = 'ORG-' + Date.now().toString().slice(-6);
  }

  return code;
}

/**
 * Generate a subdomain from organization name
 */
export function generateSubdomain(name: string): string {
  // Convert to lowercase, remove special characters, replace spaces with hyphens
  let subdomain = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 30); // Limit length

  // If empty, use a default
  if (!subdomain) {
    subdomain = 'org-' + Date.now().toString().slice(-6);
  }

  return subdomain;
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const collection = await getOrganizationsCollection();
  const now = new Date();

  // Auto-generate code if not provided
  let code = input.code?.trim();
  if (!code) {
    code = generateOrganizationCode(input.name);
    // Ensure uniqueness
    let counter = 1;
    let uniqueCode = code;
    while (await findOrganizationByCode(uniqueCode)) {
      uniqueCode = `${code}-${counter}`;
      counter++;
    }
    code = uniqueCode;
  } else {
    // Check if code already exists
    const existing = await findOrganizationByCode(code);
    if (existing) {
      throw new Error('Organization code already exists');
    }
  }

  // Auto-generate subdomain if not provided
  let subdomain = input.subdomain?.trim().toLowerCase() || null;
  if (!subdomain) {
    subdomain = generateSubdomain(input.name);
    // Ensure uniqueness
    let counter = 1;
    let uniqueSubdomain = subdomain;
    while (await findOrganizationBySubdomain(uniqueSubdomain)) {
      uniqueSubdomain = `${subdomain}-${counter}`;
      counter++;
    }
    subdomain = uniqueSubdomain;
  } else {
    // Check if subdomain already exists
    const existing = await findOrganizationBySubdomain(subdomain);
    if (existing) {
      throw new Error('Subdomain already exists');
    }
  }

  // Validate domain if provided
  if (input.domain) {
    const existing = await findOrganizationByDomain(input.domain.trim().toLowerCase());
    if (existing) {
      throw new Error('Domain already exists');
    }
  }

  const doc: Omit<Organization, '_id'> = {
    name: input.name.trim(),
    code,
    contactInfo: input.contactInfo ?? null,
    settings: input.settings ?? null,
    subscriptionId: input.subscriptionId || null,
    status: 'active',
    domain: input.domain?.trim().toLowerCase() || null,
    subdomain,
    branding: input.branding || null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Organization>);

  return {
    ...(doc as Organization),
    _id: result.insertedId.toString(),
  } as Organization;
}

export interface UpdateOrganizationInput {
  name?: string;
  code?: string;
  contactInfo?: Organization['contactInfo'];
  settings?: Organization['settings'];
  subscriptionId?: string | null;
  status?: 'active' | 'inactive' | 'suspended' | null;
  domain?: string | null;
  subdomain?: string | null;
  branding?: Organization['branding'];
  paymentReminderSettings?: Organization['paymentReminderSettings'];
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput,
): Promise<Organization | null> {
  const collection = await getOrganizationsCollection();
  const { ObjectId } = await import('mongodb');

  const updates: Partial<Organization> = {
    updatedAt: new Date(),
  };

  if (input.name) {
    updates.name = input.name.trim();
  }
  if (input.code) {
    updates.code = input.code.trim();
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.contactInfo !== undefined) {
    updates.contactInfo = input.contactInfo;
  }
  if (input.settings !== undefined) {
    updates.settings = input.settings;
  }
  if (input.subscriptionId !== undefined) {
    updates.subscriptionId = input.subscriptionId;
  }
  if (input.subdomain !== undefined) {
    updates.subdomain = input.subdomain ? input.subdomain.trim().toLowerCase() : null;
  }
  if (input.domain !== undefined) {
    updates.domain = input.domain ? input.domain.trim().toLowerCase() : null;
  }
  if (input.branding !== undefined) {
    updates.branding = input.branding;
  }
  if (input.paymentReminderSettings !== undefined) {
    updates.paymentReminderSettings = input.paymentReminderSettings;
  }

  const result = await collection.updateOne(
    { _id: new ObjectId(organizationId) } as Document,
    { $set: updates } as Document,
  );

  if (result.modifiedCount === 0) {
    return null;
  }

  return findOrganizationById(organizationId);
}

export async function deleteOrganization(organizationId: string): Promise<boolean> {
  const collection = await getOrganizationsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    // Soft delete - set status to inactive instead of actually deleting
    const result = await collection.updateOne(
      { _id: new ObjectId(organizationId) } as Document,
      {
        $set: {
          status: 'inactive',
          updatedAt: new Date(),
        },
      } as Document,
    );

    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function listOrganizations(filters?: {
  status?: 'active' | 'inactive' | 'suspended';
}): Promise<Organization[]> {
  const collection = await getOrganizationsCollection();

  const query: Record<string, unknown> = {};
  if (filters?.status) {
    query.status = filters.status;
  }

  return collection.find(query as Document).toArray();
}
