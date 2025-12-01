import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findInvoiceById } from '@/lib/invoices/invoices';
import { findTenantById } from '@/lib/tenants/tenants';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import type { AuthContext } from '@/lib/auth/authz';

const PAYMENT_INTENTS_COLLECTION_NAME = 'payment_intents';

export type PaymentProvider = 'telebirr' | 'cbe_birr' | 'chapa' | 'hellocash' | 'bank_transfer';
export type PaymentIntentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PaymentIntent {
  _id: string;
  invoiceId?: string | null; // ObjectId ref to invoices (optional)
  tenantId: string; // ObjectId ref to tenants
  organizationId: string;
  amount: number;
  currency: string; // "ETB"
  provider: PaymentProvider;
  status: PaymentIntentStatus;
  providerMetadata?: Record<string, unknown> | null;
  redirectUrl?: string | null;
  paymentInstructions?: string | null;
  referenceNumber?: string | null; // Provider's payment reference
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentInitiationResult {
  redirectUrl?: string;
  paymentInstructions?: string;
  referenceNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentVerificationResult {
  success: boolean;
  referenceNumber?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export async function getPaymentIntentsCollection(): Promise<Collection<PaymentIntent>> {
  const db = await getDb();
  return db.collection<PaymentIntent>(PAYMENT_INTENTS_COLLECTION_NAME);
}

export async function ensurePaymentIntentIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PAYMENT_INTENTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, tenantId, and status
    {
      key: { organizationId: 1, tenantId: 1, status: 1 },
      name: 'org_tenant_status',
    },
    // Compound index on organizationId and invoiceId
    {
      key: { organizationId: 1, invoiceId: 1 },
      sparse: true,
      name: 'org_invoice',
    },
    // Index on referenceNumber (for webhook lookups)
    {
      key: { referenceNumber: 1 },
      sparse: true,
      name: 'referenceNumber',
    },
    // Index on expiresAt (for cleanup of expired intents)
    {
      key: { expiresAt: 1 },
      name: 'expiresAt',
    },
  ];

  await collection.createIndexes(indexes);
}

export interface CreatePaymentIntentInput {
  invoiceId?: string | null;
  tenantId: string;
  organizationId: string;
  amount: number;
  currency?: string;
  provider: PaymentProvider;
  expiresInMinutes?: number; // Default: 30 minutes
}

/**
 * Validates that a tenant exists and belongs to the same organization.
 */
async function validateTenantBelongsToOrg(tenantId: string, organizationId: string): Promise<void> {
  const tenant = await findTenantById(tenantId, organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  if (tenant.organizationId !== organizationId) {
    throw new Error('Tenant does not belong to the same organization');
  }
}

/**
 * Validates that an invoice exists, belongs to the same organization, and matches the tenant.
 */
async function validateInvoiceForPayment(
  invoiceId: string,
  tenantId: string,
  organizationId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof findInvoiceById>>>> {
  const invoice = await findInvoiceById(invoiceId, organizationId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  if (invoice.organizationId !== organizationId) {
    throw new Error('Invoice does not belong to the same organization');
  }
  if (invoice.tenantId !== tenantId) {
    throw new Error('Invoice does not belong to the same tenant');
  }
  return invoice as NonNullable<Awaited<ReturnType<typeof findInvoiceById>>>;
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
  const collection = await getPaymentIntentsCollection();
  const now = new Date();

  // Validate tenant exists and belongs to same org
  await validateTenantBelongsToOrg(input.tenantId, input.organizationId);

  // If invoiceId is provided, validate it
  if (input.invoiceId) {
    const invoice = await validateInvoiceForPayment(
      input.invoiceId,
      input.tenantId,
      input.organizationId,
    );

    // Validate amount matches invoice total (allow small tolerance for rounding)
    const amountDifference = Math.abs(input.amount - invoice.total);
    if (amountDifference > 0.01) {
      throw new Error(
        `Payment amount (${input.amount}) does not match invoice total (${invoice.total})`,
      );
    }
  }

  // Validate amount
  if (input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // Set expiration (default: 30 minutes from now)
  const expiresInMinutes = input.expiresInMinutes ?? 30;
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

  const doc: Omit<PaymentIntent, '_id'> = {
    invoiceId: input.invoiceId ?? null,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    amount: input.amount,
    currency: input.currency ?? 'ETB',
    provider: input.provider,
    status: 'pending',
    providerMetadata: null,
    redirectUrl: null,
    paymentInstructions: null,
    referenceNumber: null,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<PaymentIntent>);

  return {
    ...(doc as PaymentIntent),
    _id: result.insertedId.toString(),
  } as PaymentIntent;
}

export async function findPaymentIntentById(
  intentId: string,
  organizationId?: string,
): Promise<PaymentIntent | null> {
  const collection = await getPaymentIntentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(intentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findPaymentIntentByReference(
  referenceNumber: string,
  organizationId?: string,
): Promise<PaymentIntent | null> {
  const collection = await getPaymentIntentsCollection();

  const query: Record<string, unknown> = {
    referenceNumber,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

export async function updatePaymentIntent(
  intentId: string,
  updates: Partial<PaymentIntent> & {
    redirectUrl?: string | null;
    paymentInstructions?: string | null;
    referenceNumber?: string | null;
    providerMetadata?: Record<string, unknown> | null;
  },
): Promise<PaymentIntent | null> {
  const collection = await getPaymentIntentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.tenantId;
    delete updateDoc.createdAt;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(intentId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as PaymentIntent | null;
  } catch {
    return null;
  }
}

export async function cancelPaymentIntent(intentId: string): Promise<PaymentIntent | null> {
  return updatePaymentIntent(intentId, {
    status: 'cancelled',
  });
}

export async function findPaymentIntentsByTenant(
  tenantId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<PaymentIntent[]> {
  const collection = await getPaymentIntentsCollection();

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
