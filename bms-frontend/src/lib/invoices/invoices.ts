import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findLeaseById } from '@/lib/leases/leases';

const INVOICES_COLLECTION_NAME = 'invoices';

export type InvoiceItemType = 'rent' | 'charge' | 'penalty' | 'deposit' | 'other';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceType = 'rent' | 'maintenance' | 'penalty' | 'parking' | 'other';

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
  subtotal: number; // Amount before VAT
  tax?: number | null; // VAT amount (15% of subtotal)
  vatRate?: number | null; // VAT rate percentage (default: 15%)
  total: number; // Subtotal + VAT
  netIncomeBeforeVat?: number | null; // Net income excluding VAT
  netIncomeAfterVat?: number | null; // Net income including VAT (same as total for tenant invoices)
  status: InvoiceStatus;
  paidAt?: Date | null;
  notes?: string | null;
  // New fields for enhanced billing
  invoiceType?: InvoiceType; // Type of invoice (rent, maintenance, penalty, parking, other)
  linkedWorkOrderId?: string | null; // Reference to work order for maintenance invoices
  linkedInvoiceId?: string | null; // Reference to original invoice for penalty invoices
  templateId?: string | null; // Reference to invoice template used
  currency?: string; // Currency code (default: 'ETB')
  exchangeRate?: number | null; // Exchange rate at invoice creation (for USD invoices)
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
    // Index on invoiceType
    {
      key: { invoiceType: 1 },
      sparse: true,
      name: 'invoiceType',
    },
    // Index on linkedWorkOrderId
    {
      key: { linkedWorkOrderId: 1 },
      sparse: true,
      name: 'linkedWorkOrderId',
    },
    // Index on linkedInvoiceId
    {
      key: { linkedInvoiceId: 1 },
      sparse: true,
      name: 'linkedInvoiceId',
    },
    // Index on templateId
    {
      key: { templateId: 1 },
      sparse: true,
      name: 'templateId',
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
 * Calculates invoice totals from items and optional tax/VAT.
 * If vatRate is provided, calculates VAT on subtotal.
 * Otherwise uses provided tax amount.
 */
export function calculateInvoiceTotals(
  items: InvoiceItem[],
  tax?: number | null,
  vatRate?: number | null,
): {
  subtotal: number;
  tax: number;
  total: number;
  netIncomeBeforeVat: number;
  netIncomeAfterVat: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  let taxAmount = 0;
  if (vatRate !== null && vatRate !== undefined) {
    // Calculate VAT based on rate
    taxAmount = Math.round((subtotal * vatRate) / 100);
  } else if (tax !== null && tax !== undefined) {
    // Use provided tax amount
    taxAmount = tax;
  }

  const total = subtotal + taxAmount;
  const netIncomeBeforeVat = subtotal; // Net income before VAT
  const netIncomeAfterVat = total; // Net income after VAT (what tenant pays)

  return { subtotal, tax: taxAmount, total, netIncomeBeforeVat, netIncomeAfterVat };
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
  tax?: number | null; // Tax/VAT amount (if provided directly)
  vatRate?: number | null; // VAT rate percentage (default: 15%)
  status?: InvoiceStatus;
  notes?: string | null;
  // New fields
  invoiceType?: InvoiceType;
  linkedWorkOrderId?: string | null;
  linkedInvoiceId?: string | null;
  templateId?: string | null;
  currency?: string; // Default: 'ETB'
  exchangeRate?: number | null;
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

  // Calculate totals with VAT
  const vatRate = input.vatRate ?? 15; // Default 15% VAT
  const {
    subtotal,
    tax: taxAmount,
    total,
    netIncomeBeforeVat,
    netIncomeAfterVat,
  } = calculateInvoiceTotals(input.items, input.tax, vatRate);

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
    vatRate,
    total,
    netIncomeBeforeVat,
    netIncomeAfterVat,
    status: input.status ?? 'draft',
    paidAt: null,
    notes: input.notes ?? null,
    // New fields
    invoiceType: input.invoiceType ?? 'rent',
    linkedWorkOrderId: input.linkedWorkOrderId ?? null,
    linkedInvoiceId: input.linkedInvoiceId ?? null,
    templateId: input.templateId ?? null,
    currency: input.currency ?? 'ETB',
    exchangeRate: input.exchangeRate ?? null,
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

    const isItemUpdate = updates.items && updates.items.length > 0;
    const canMutateItems =
      existingInvoice.status === 'draft' ||
      existingInvoice.status === 'sent' ||
      existingInvoice.status === 'overdue';

    if (
      !isStatusOnlyUpdate &&
      !canMutateItems &&
      updates.status !== 'sent' &&
      updates.status !== 'paid' &&
      updates.status !== 'overdue'
    ) {
      throw new Error(
        'Only draft/sent/overdue invoices can be modified. Use status update for other changes.',
      );
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
      const vatRate = updates.vatRate !== undefined ? updates.vatRate : existingInvoice.vatRate;
      const {
        subtotal,
        tax: taxAmount,
        total,
      } = calculateInvoiceTotals(updates.items, tax, vatRate ?? undefined);
      updateDoc.subtotal = subtotal;
      updateDoc.tax = taxAmount;
      updateDoc.total = total;
    } else if (updates.tax !== undefined || updates.vatRate !== undefined) {
      // If only tax/vat is being updated, recalculate total
      const vatRate = updates.vatRate !== undefined ? updates.vatRate : existingInvoice.vatRate;
      const tax = updates.tax !== undefined ? updates.tax : existingInvoice.tax;
      const {
        subtotal,
        tax: taxAmount,
        total,
      } = calculateInvoiceTotals(existingInvoice.items, tax, vatRate ?? undefined);
      updateDoc.subtotal = subtotal;
      updateDoc.tax = taxAmount;
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

/**
 * Creates an ad-hoc invoice for maintenance, penalties, or other charges.
 * Supports invoices linked to work orders (maintenance) or original invoices (penalties).
 */
export interface CreateAdHocInvoiceInput {
  organizationId: string;
  invoiceType: InvoiceType; // 'maintenance' | 'penalty' | 'other'
  tenantId: string;
  unitId?: string | null | undefined; // Optional for non-lease invoices
  items: InvoiceItem[];
  issueDate?: Date | string | undefined;
  dueDate: Date | string;
  periodStart?: Date | string | undefined; // Optional for ad-hoc invoices
  periodEnd?: Date | string | undefined; // Optional for ad-hoc invoices
  vatRate?: number | null | undefined;
  notes?: string | null | undefined;
  // Linking fields
  linkedWorkOrderId?: string | null | undefined; // For maintenance invoices
  linkedInvoiceId?: string | null | undefined; // For penalty invoices
  leaseId?: string | null | undefined; // Optional - if tenant has active lease, link to it
  // Currency support
  currency?: string | undefined;
  exchangeRate?: number | null | undefined;
}

export async function createAdHocInvoice(input: CreateAdHocInvoiceInput): Promise<Invoice> {
  const { findTenantById } = await import('@/lib/tenants/tenants');
  const { findLeasesByTenant } = await import('@/lib/leases/leases');
  const { findWorkOrderById } = await import('@/lib/work-orders/work-orders');

  // Validate tenant
  const tenant = await findTenantById(input.tenantId, input.organizationId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Validate invoice type and linked resources
  if (input.invoiceType === 'maintenance' && input.linkedWorkOrderId) {
    const workOrder = await findWorkOrderById(input.linkedWorkOrderId, input.organizationId);
    if (!workOrder) {
      throw new Error('Work order not found');
    }
    if (workOrder.organizationId !== input.organizationId) {
      throw new Error('Work order does not belong to the same organization');
    }
    // Use work order's unitId if not provided
    if (!input.unitId && workOrder.unitId) {
      input.unitId = workOrder.unitId;
    }
  }

  if (input.invoiceType === 'penalty' && input.linkedInvoiceId) {
    const originalInvoice = await findInvoiceById(input.linkedInvoiceId, input.organizationId);
    if (!originalInvoice) {
      throw new Error('Original invoice not found');
    }
    if (originalInvoice.organizationId !== input.organizationId) {
      throw new Error('Original invoice does not belong to the same organization');
    }
    if (originalInvoice.tenantId !== input.tenantId) {
      throw new Error('Original invoice does not belong to the same tenant');
    }
    // Use original invoice's unitId and leaseId if not provided
    if (!input.unitId) {
      input.unitId = originalInvoice.unitId;
    }
    if (!input.leaseId) {
      input.leaseId = originalInvoice.leaseId;
    }
  }

  // Find active lease for tenant if not provided
  let leaseId = input.leaseId;
  if (!leaseId) {
    const leases = await findLeasesByTenant(input.tenantId, input.organizationId);
    const activeLease = leases.find(
      (lease) =>
        lease.status === 'active' &&
        (lease.endDate === null ||
          lease.endDate === undefined ||
          (lease.endDate && new Date(lease.endDate) >= new Date())),
    );
    if (activeLease) {
      leaseId = activeLease._id;
      if (!input.unitId) {
        input.unitId = activeLease.unitId;
      }
    }
  }

  // If no lease found, we still allow creating the invoice but require unitId
  if (!leaseId && !input.unitId) {
    throw new Error('Either leaseId or unitId must be provided');
  }

  // For invoices without a lease, we'll use a placeholder leaseId
  // In production, you might want to create a special "ad-hoc" lease or handle this differently
  if (!leaseId) {
    throw new Error('Tenant must have an active lease or unitId must be provided');
  }

  const now = new Date();
  const issueDate =
    input.issueDate && typeof input.issueDate === 'string'
      ? new Date(input.issueDate)
      : input.issueDate || now;
  const dueDate = typeof input.dueDate === 'string' ? new Date(input.dueDate) : input.dueDate;
  const periodStart =
    input.periodStart && typeof input.periodStart === 'string'
      ? new Date(input.periodStart)
      : input.periodStart || issueDate;
  const periodEnd =
    input.periodEnd && typeof input.periodEnd === 'string'
      ? new Date(input.periodEnd)
      : input.periodEnd || dueDate;

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new Error('Invoice must have at least one item');
  }

  // Create invoice using the standard createInvoice function
  return createInvoice({
    organizationId: input.organizationId,
    leaseId,
    tenantId: input.tenantId,
    unitId: input.unitId || '', // Will be validated in createInvoice
    issueDate,
    dueDate,
    periodStart,
    periodEnd,
    items: input.items,
    vatRate: input.vatRate ?? 15,
    status: 'sent', // Ad-hoc invoices are typically sent immediately
    notes: input.notes ?? null,
    invoiceType: input.invoiceType,
    linkedWorkOrderId: input.linkedWorkOrderId ?? null,
    linkedInvoiceId: input.linkedInvoiceId ?? null,
    currency: input.currency ?? 'ETB',
    exchangeRate: input.exchangeRate ?? null,
  });
}

/**
 * Creates a parking invoice for a parking assignment.
 * For tenant parking: finds the tenant's active lease and creates invoice linked to it.
 * For visitor parking: creates a building-level invoice (requires manual lease/unit setup).
 */
export interface CreateParkingInvoiceInput {
  organizationId: string;
  parkingAssignmentId: string;
  amount: number;
  description: string;
  issueDate?: Date | string;
  dueDate?: Date | string;
  periodStart?: Date | string;
  periodEnd?: Date | string;
  vatRate?: number | null;
  notes?: string | null;
}

export async function createParkingInvoice(input: CreateParkingInvoiceInput): Promise<Invoice> {
  // Import parking assignment functions
  const { findParkingAssignmentById } = await import('@/lib/parking/parking-assignments');
  const { findLeasesByTenant } = await import('@/lib/leases/leases');
  const { findTenantById } = await import('@/lib/tenants/tenants');

  // Get parking assignment
  const assignment = await findParkingAssignmentById(
    input.parkingAssignmentId,
    input.organizationId,
  );

  if (!assignment) {
    throw new Error('Parking assignment not found');
  }

  if (assignment.organizationId !== input.organizationId) {
    throw new Error('Parking assignment does not belong to the same organization');
  }

  // For tenant parking, find active lease
  if (assignment.assignmentType === 'tenant' && assignment.tenantId) {
    const tenant = await findTenantById(assignment.tenantId, input.organizationId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Find active lease for tenant
    const leases = await findLeasesByTenant(assignment.tenantId, input.organizationId);
    const activeLease = leases.find(
      (lease) =>
        lease.status === 'active' &&
        (lease.endDate === null ||
          lease.endDate === undefined ||
          (lease.endDate && new Date(lease.endDate) >= new Date())),
    );

    if (!activeLease) {
      throw new Error('Tenant does not have an active lease. Cannot create parking invoice.');
    }

    // Create invoice using tenant's active lease
    const now = new Date();
    const issueDate =
      input.issueDate && typeof input.issueDate === 'string'
        ? new Date(input.issueDate)
        : input.issueDate || now;
    const dueDate =
      input.dueDate && typeof input.dueDate === 'string'
        ? new Date(input.dueDate)
        : input.dueDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const periodStart =
      input.periodStart && typeof input.periodStart === 'string'
        ? new Date(input.periodStart)
        : input.periodStart || assignment.startDate;
    const periodEnd =
      input.periodEnd && typeof input.periodEnd === 'string'
        ? new Date(input.periodEnd)
        : input.periodEnd || assignment.endDate || now;

    return createInvoice({
      organizationId: input.organizationId,
      leaseId: activeLease._id,
      tenantId: assignment.tenantId,
      unitId: activeLease.unitId,
      issueDate,
      dueDate,
      periodStart,
      periodEnd,
      items: [
        {
          description: input.description,
          amount: input.amount,
          type: 'other', // Parking is a special charge type
        },
      ],
      vatRate: input.vatRate ?? 15,
      status: 'sent',
      notes: input.notes || `Parking assignment: ${input.parkingAssignmentId}`,
    });
  } else {
    // For visitor parking, we need to create a special invoice
    // Since visitors don't have leases, we'll need a different approach
    // For now, throw an error indicating manual invoice creation is needed
    throw new Error(
      'Visitor parking invoices require manual creation. Please create invoice manually for visitor parking.',
    );
  }
}
