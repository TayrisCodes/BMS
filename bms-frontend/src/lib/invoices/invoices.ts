import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findLeaseById } from '@/lib/leases/leases';

const INVOICES_COLLECTION_NAME = 'invoices';

export type InvoiceItemType = 'rent' | 'charge' | 'penalty' | 'deposit' | 'other';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  description: string;
  amount: number;
  type: InvoiceItemType;
}

export interface Invoice {
  _id: string;
  organizationId: string;
  leaseId: string; // ObjectId ref to leases
  tenantId: string; // ObjectId ref to tenants
  unitId: string; // ObjectId ref to units
  invoiceNumber: string; // Unique per org, e.g., "INV-2024-001"
  issueDate: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  items: InvoiceItem[];
  subtotal: number;
  tax?: number | null;
  total: number;
  status: InvoiceStatus;
  paidAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getInvoicesCollection(): Promise<Collection<Invoice>> {
  const db = await getDb();
  return db.collection<Invoice>(INVOICES_COLLECTION_NAME);
}

export async function ensureInvoiceIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(INVOICES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound unique index on organizationId and invoiceNumber
    {
      key: { organizationId: 1, invoiceNumber: 1 },
      unique: true,
      name: 'unique_org_invoice_number',
    },
    // Compound index on organizationId, tenantId, and status
    {
      key: { organizationId: 1, tenantId: 1, status: 1 },
      name: 'org_tenant_status',
    },
    // Compound index on organizationId, leaseId, and status
    {
      key: { organizationId: 1, leaseId: 1, status: 1 },
      name: 'org_lease_status',
    },
    // Index on dueDate (for overdue queries)
    {
      key: { dueDate: 1 },
      name: 'dueDate',
    },
    // Index on status
    {
      key: { status: 1 },
      name: 'status',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Generates a unique invoice number for an organization.
 * Format: "INV-YYYY-XXX" where YYYY is the year and XXX is a 3-digit sequence number.
 */
export async function generateInvoiceNumber(organizationId: string): Promise<string> {
  const collection = await getInvoicesCollection();
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  // Find the highest invoice number for this organization and year
  const lastInvoice = await collection
    .find({
      organizationId,
      invoiceNumber: { $regex: `^${prefix}` },
    } as Document)
    .sort({ invoiceNumber: -1 })
    .limit(1)
    .toArray();

  let nextSequence = 1;

  if (lastInvoice.length > 0 && lastInvoice[0]?.invoiceNumber) {
    const lastNumber = lastInvoice[0].invoiceNumber;
    const match = lastNumber.match(/^INV-\d{4}-(\d+)$/);
    const matchedSequence = match?.[1];
    if (matchedSequence) {
      const lastSequence = parseInt(matchedSequence, 10);
      nextSequence = lastSequence + 1;
    }
  }

  // Format with 3 digits (001, 002, etc.)
  const sequenceStr = nextSequence.toString().padStart(3, '0');
  return `${prefix}${sequenceStr}`;
}

/**
 * Validates that a lease exists and belongs to the same organization.
 * Returns the lease for further validation.
 */
async function validateLeaseBelongsToOrg(
  leaseId: string,
  organizationId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof findLeaseById>>>> {
  const lease = await findLeaseById(leaseId, organizationId);
  if (!lease) {
    throw new Error('Lease not found');
  }
  if (lease.organizationId !== organizationId) {
    throw new Error('Lease does not belong to the same organization');
  }
  return lease as NonNullable<Awaited<ReturnType<typeof findLeaseById>>>;
}

/**
 * Calculates invoice totals from items and optional tax.
 */
function calculateInvoiceTotals(
  items: InvoiceItem[],
  tax?: number | null,
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = tax ?? 0;
  const total = subtotal + taxAmount;

  return { subtotal, tax: taxAmount, total };
}

export interface CreateInvoiceInput {
  organizationId: string;
  leaseId: string;
  tenantId: string;
  unitId: string;
  invoiceNumber?: string; // Optional, will be generated if not provided
  issueDate: Date | string;
  dueDate: Date | string;
  periodStart: Date | string;
  periodEnd: Date | string;
  items: InvoiceItem[];
  tax?: number | null;
  status?: InvoiceStatus;
  notes?: string | null;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const collection = await getInvoicesCollection();
  const now = new Date();

  // Validate lease exists and belongs to same org
  const lease = await validateLeaseBelongsToOrg(input.leaseId, input.organizationId);

  // Validate tenant and unit match lease
  if (lease.tenantId !== input.tenantId) {
    throw new Error('Tenant ID does not match the lease');
  }
  if (lease.unitId !== input.unitId) {
    throw new Error('Unit ID does not match the lease');
  }

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new Error('Invoice must have at least one item');
  }

  // Generate invoice number if not provided
  const invoiceNumber = input.invoiceNumber ?? (await generateInvoiceNumber(input.organizationId));

  // Convert dates to Date objects if strings
  const issueDate =
    typeof input.issueDate === 'string' ? new Date(input.issueDate) : input.issueDate;
  const dueDate = typeof input.dueDate === 'string' ? new Date(input.dueDate) : input.dueDate;
  const periodStart =
    typeof input.periodStart === 'string' ? new Date(input.periodStart) : input.periodStart;
  const periodEnd =
    typeof input.periodEnd === 'string' ? new Date(input.periodEnd) : input.periodEnd;

  // Validate dates
  if (isNaN(issueDate.getTime())) {
    throw new Error('Invalid issue date');
  }
  if (isNaN(dueDate.getTime())) {
    throw new Error('Invalid due date');
  }
  if (isNaN(periodStart.getTime())) {
    throw new Error('Invalid period start date');
  }
  if (isNaN(periodEnd.getTime())) {
    throw new Error('Invalid period end date');
  }
  if (periodEnd < periodStart) {
    throw new Error('Period end date must be after period start date');
  }

  // Calculate totals
  const { subtotal, tax: taxAmount, total } = calculateInvoiceTotals(input.items, input.tax);

  const doc: Omit<Invoice, '_id'> = {
    organizationId: input.organizationId,
    leaseId: input.leaseId,
    tenantId: input.tenantId,
    unitId: input.unitId,
    invoiceNumber,
    issueDate,
    dueDate,
    periodStart,
    periodEnd,
    items: input.items,
    subtotal,
    tax: taxAmount,
    total,
    status: input.status ?? 'draft',
    paidAt: null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Invoice>);

  return {
    ...(doc as Invoice),
    _id: result.insertedId.toString(),
  } as Invoice;
}

export async function findInvoiceById(
  invoiceId: string,
  organizationId?: string,
): Promise<Invoice | null> {
  const collection = await getInvoicesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(invoiceId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findInvoicesByTenant(
  tenantId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<Invoice[]> {
  const collection = await getInvoicesCollection();

  const query: Record<string, unknown> = {
    tenantId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ dueDate: -1 })
    .toArray();
}

export async function findInvoicesByLease(
  leaseId: string,
  organizationId?: string,
): Promise<Invoice[]> {
  const collection = await getInvoicesCollection();

  const query: Record<string, unknown> = {
    leaseId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ issueDate: -1 })
    .toArray();
}

export async function findOverdueInvoices(
  organizationId: string,
  asOfDate?: Date,
): Promise<Invoice[]> {
  const collection = await getInvoicesCollection();
  const cutoffDate = asOfDate ?? new Date();

  const query: Record<string, unknown> = {
    organizationId,
    status: { $in: ['draft', 'sent'] as InvoiceStatus[] },
    dueDate: { $lt: cutoffDate },
  };

  return collection
    .find(query as Document)
    .sort({ dueDate: 1 })
    .toArray();
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  paidAt?: Date | null,
): Promise<Invoice | null> {
  const collection = await getInvoicesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingInvoice = await findInvoiceById(invoiceId);
    if (!existingInvoice) {
      return null;
    }

    const now = new Date();
    const updateDoc: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    // If status is "paid", set paidAt
    if (status === 'paid') {
      updateDoc.paidAt = paidAt ?? now;
    } else if (existingInvoice.status === 'paid') {
      // If changing from paid to non-paid, clear paidAt
      updateDoc.paidAt = null;
    }

    // If status is "overdue" and there's no paidAt, don't set paidAt
    if (status === 'overdue') {
      updateDoc.paidAt = null;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(invoiceId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Invoice | null;
  } catch {
    return null;
  }
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>,
): Promise<Invoice | null> {
  const collection = await getInvoicesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingInvoice = await findInvoiceById(invoiceId);
    if (!existingInvoice) {
      return null;
    }

    // Only allow updates to draft invoices (unless updating status only)
    const isStatusOnlyUpdate =
      updates.status !== undefined &&
      Object.keys(updates).filter((k) => k !== 'status' && k !== 'paidAt' && k !== 'notes')
        .length === 0;

    if (
      existingInvoice.status !== 'draft' &&
      !isStatusOnlyUpdate &&
      updates.status !== 'sent' &&
      updates.status !== 'paid' &&
      updates.status !== 'overdue'
    ) {
      throw new Error('Only draft invoices can be modified. Use status update for other changes.');
    }

    const updateDoc: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated
    delete updateDoc._id;
    delete updateDoc.organizationId;
    delete updateDoc.createdAt;

    // If items are being updated, recalculate totals
    if (updates.items && updates.items.length > 0) {
      const tax = updates.tax !== undefined ? updates.tax : existingInvoice.tax;
      const { subtotal, tax: taxAmount, total } = calculateInvoiceTotals(updates.items, tax);
      updateDoc.subtotal = subtotal;
      updateDoc.tax = taxAmount;
      updateDoc.total = total;
    } else if (updates.tax !== undefined) {
      // If only tax is being updated, recalculate total
      const { total } = calculateInvoiceTotals(existingInvoice.items, updates.tax);
      updateDoc.total = total;
    }

    // Convert date strings to Date objects if present
    const dateFields = ['issueDate', 'dueDate', 'periodStart', 'periodEnd', 'paidAt'];
    for (const field of dateFields) {
      if (updateDoc[field] && typeof updateDoc[field] === 'string') {
        updateDoc[field] = new Date(updateDoc[field] as string);
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(invoiceId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Invoice | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function cancelInvoice(invoiceId: string): Promise<Invoice | null> {
  const collection = await getInvoicesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingInvoice = await findInvoiceById(invoiceId);
    if (!existingInvoice) {
      return null;
    }

    // Only allow cancellation of non-paid invoices
    if (existingInvoice.status === 'paid') {
      throw new Error('Cannot cancel a paid invoice');
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(invoiceId) } as Document,
      {
        $set: {
          status: 'cancelled' as InvoiceStatus,
          updatedAt: new Date(),
        },
      } as Document,
      { returnDocument: 'after' },
    );

    return result as Invoice | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listInvoices(query: Record<string, unknown> = {}): Promise<Invoice[]> {
  const collection = await getInvoicesCollection();

  return collection
    .find(query as Document)
    .sort({ issueDate: -1 })
    .toArray();
}

