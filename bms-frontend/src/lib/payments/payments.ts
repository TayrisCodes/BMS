import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';
import { findInvoiceById, updateInvoiceStatus, type InvoiceStatus } from '@/lib/invoices/invoices';
import { findTenantById } from '@/lib/tenants/tenants';

const PAYMENTS_COLLECTION_NAME = 'payments';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'telebirr'
  | 'cbe_birr'
  | 'chapa'
  | 'hellocash'
  | 'other';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  _id: string;
  organizationId: string;
  invoiceId?: string | null; // ObjectId ref to invoices (optional for manual payments)
  tenantId: string; // ObjectId ref to tenants
  amount: number; // Amount in currency
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  referenceNumber?: string | null; // External payment reference (for idempotency)
  status: PaymentStatus;
  providerResponse?: Record<string, unknown> | null; // Payment gateway response data
  notes?: string | null;
  createdBy?: string | null; // ObjectId ref to users
  // New fields for enhanced payment tracking
  currency?: string; // Currency code (default: 'ETB')
  exchangeRate?: number | null; // Exchange rate at payment time (for USD payments)
  providerTransactionId?: string | null; // Provider's transaction ID
  reconciliationStatus?: 'pending' | 'reconciled' | 'disputed'; // Reconciliation status
  failureReason?: string | null; // Reason for payment failure
  retryAttempts?: number; // Number of retry attempts
  lastRetryAt?: Date | null; // Last retry timestamp
  receiptUrl?: string | null; // URL to generated receipt PDF
  createdAt: Date;
  updatedAt: Date;
}

export async function getPaymentsCollection(): Promise<Collection<Payment>> {
  const db = await getDb();
  return db.collection<Payment>(PAYMENTS_COLLECTION_NAME);
}

export async function ensurePaymentIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(PAYMENTS_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Compound index on organizationId, tenantId, and status
    {
      key: { organizationId: 1, tenantId: 1, status: 1 },
      name: 'org_tenant_status',
    },
    // Compound index on organizationId and invoiceId
    {
      key: { organizationId: 1, invoiceId: 1 },
      name: 'org_invoice',
    },
    // Index on paymentDate
    {
      key: { paymentDate: 1 },
      name: 'paymentDate',
    },
    // Unique sparse index on referenceNumber (for idempotency checks)
    {
      key: { referenceNumber: 1 },
      unique: true,
      sparse: true,
      name: 'unique_reference_number',
    },
    // Index on reconciliationStatus
    {
      key: { reconciliationStatus: 1 },
      sparse: true,
      name: 'reconciliationStatus',
    },
    // Index on providerTransactionId
    {
      key: { providerTransactionId: 1 },
      sparse: true,
      name: 'providerTransactionId',
    },
    // Compound index for reconciliation queries
    {
      key: { organizationId: 1, reconciliationStatus: 1, status: 1 },
      name: 'org_reconciliation_status',
    },
  ];

  await collection.createIndexes(indexes);
}

/**
 * Validates that a tenant exists and belongs to the same organization.
 * Throws an error if validation fails.
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
 * Returns the invoice for further validation.
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

/**
 * Checks if a payment with the given referenceNumber already exists.
 * Throws an error if duplicate found (for idempotency).
 */
async function checkReferenceNumberIdempotency(
  referenceNumber: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!referenceNumber) {
    return; // No reference number provided, skip check
  }

  const existingPayment = await findPaymentByReference(referenceNumber, organizationId);
  if (existingPayment) {
    throw new Error(
      `Payment with reference number "${referenceNumber}" already exists (idempotency check failed)`,
    );
  }
}

export interface CreatePaymentInput {
  organizationId: string;
  invoiceId?: string | null;
  tenantId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date | string;
  referenceNumber?: string | null;
  status?: PaymentStatus;
  providerResponse?: Record<string, unknown> | null;
  notes?: string | null;
  createdBy?: string | null;
  // New fields
  currency?: string; // Default: 'ETB'
  exchangeRate?: number | null;
  providerTransactionId?: string | null;
  reconciliationStatus?: 'pending' | 'reconciled' | 'disputed';
  failureReason?: string | null;
  retryAttempts?: number;
  receiptUrl?: string | null;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const collection = await getPaymentsCollection();
  const now = new Date();

  // Validate tenant exists and belongs to same org
  await validateTenantBelongsToOrg(input.tenantId, input.organizationId);

  // Check reference number idempotency
  await checkReferenceNumberIdempotency(input.referenceNumber, input.organizationId);

  // If invoiceId is provided, validate and link payment
  let invoice = null;
  if (input.invoiceId) {
    invoice = await validateInvoiceForPayment(
      input.invoiceId,
      input.tenantId,
      input.organizationId,
    );

    // Check if invoice is already paid (optional - allow overpayments)
    // For now, we'll allow payments even if invoice is already paid
    // This allows for deposits, overpayments, etc.
  }

  // Convert paymentDate to Date if string
  const paymentDate =
    typeof input.paymentDate === 'string' ? new Date(input.paymentDate) : input.paymentDate;

  // Validate paymentDate
  if (isNaN(paymentDate.getTime())) {
    throw new Error('Invalid payment date');
  }

  // Validate amount
  if (input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // If invoice is provided, validate amount (allow partial payments)
  if (invoice) {
    // Get all existing payments for this invoice
    const existingPayments = await findPaymentsByInvoice(invoice._id, input.organizationId);
    const totalPaid = existingPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    // Allow partial payments, but warn if overpaying (we'll allow it for now)
    // In a production system, you might want to reject overpayments or create a credit
  }

  const doc: Omit<Payment, '_id'> = {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId ?? null,
    tenantId: input.tenantId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paymentDate,
    referenceNumber: input.referenceNumber ?? null,
    status: input.status ?? 'completed',
    providerResponse: input.providerResponse ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
    // New fields
    currency: input.currency ?? 'ETB',
    exchangeRate: input.exchangeRate ?? null,
    providerTransactionId: input.providerTransactionId ?? null,
    reconciliationStatus: input.reconciliationStatus ?? 'pending',
    failureReason: input.failureReason ?? null,
    retryAttempts: input.retryAttempts ?? 0,
    lastRetryAt: null,
    receiptUrl: input.receiptUrl ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Payment>);

  const payment = {
    ...(doc as Payment),
    _id: result.insertedId.toString(),
  } as Payment;

  // If invoiceId is provided and payment is completed, update invoice status to "paid"
  if (input.invoiceId && payment.status === 'completed') {
    // Get all payments for this invoice
    const allPayments = await findPaymentsByInvoice(input.invoiceId, input.organizationId);
    const totalPaid = allPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    // If total paid >= invoice total, mark invoice as paid
    if (invoice && totalPaid >= invoice.total) {
      await updateInvoiceStatus(input.invoiceId, 'paid' as InvoiceStatus, paymentDate).catch(
        (error) => {
          console.error('Failed to update invoice status to paid:', error);
          // Don't throw - payment is already created
        },
      );
    }
  }

  return payment;
}

export async function findPaymentById(
  paymentId: string,
  organizationId?: string,
): Promise<Payment | null> {
  const collection = await getPaymentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(paymentId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findPaymentsByTenant(
  tenantId: string,
  organizationId?: string,
  filters?: Record<string, unknown>,
): Promise<Payment[]> {
  const collection = await getPaymentsCollection();

  const query: Record<string, unknown> = {
    tenantId,
    ...filters,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ paymentDate: -1 })
    .toArray();
}

export async function findPaymentsByInvoice(
  invoiceId: string,
  organizationId?: string,
): Promise<Payment[]> {
  const collection = await getPaymentsCollection();

  const query: Record<string, unknown> = {
    invoiceId,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection
    .find(query as Document)
    .sort({ paymentDate: -1 })
    .toArray();
}

export async function findPaymentByReference(
  referenceNumber: string,
  organizationId?: string,
): Promise<Payment | null> {
  const collection = await getPaymentsCollection();

  const query: Record<string, unknown> = {
    referenceNumber,
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return collection.findOne(query as Document);
}

export async function updatePayment(
  paymentId: string,
  updates: Partial<Payment>,
): Promise<Payment | null> {
  const collection = await getPaymentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingPayment = await findPaymentById(paymentId);
    if (!existingPayment) {
      return null;
    }

    // Only allow updates to pending payments
    if (
      existingPayment.status !== 'pending' &&
      updates.status !== 'completed' &&
      updates.status !== 'failed'
    ) {
      throw new Error('Only pending payments can be modified');
    }

    // If referenceNumber is being updated, check for idempotency
    if (updates.referenceNumber && updates.referenceNumber !== existingPayment.referenceNumber) {
      await checkReferenceNumberIdempotency(
        updates.referenceNumber,
        existingPayment.organizationId,
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

    // Convert date strings to Date objects if present
    if (updateDoc.paymentDate && typeof updateDoc.paymentDate === 'string') {
      updateDoc.paymentDate = new Date(updateDoc.paymentDate);
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(paymentId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    // If payment status changed to completed and invoiceId exists, update invoice
    if (
      updates.status === 'completed' &&
      existingPayment.status !== 'completed' &&
      existingPayment.invoiceId
    ) {
      const allPayments = await findPaymentsByInvoice(
        existingPayment.invoiceId,
        existingPayment.organizationId,
      );
      const totalPaid = allPayments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      const invoice = await findInvoiceById(
        existingPayment.invoiceId,
        existingPayment.organizationId,
      );
      if (invoice && totalPaid >= invoice.total) {
        await updateInvoiceStatus(
          existingPayment.invoiceId,
          'paid' as InvoiceStatus,
          existingPayment.paymentDate,
        ).catch((error) => {
          console.error('Failed to update invoice status:', error);
        });
      }
    }

    return result as Payment | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function refundPayment(paymentId: string): Promise<Payment | null> {
  const collection = await getPaymentsCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingPayment = await findPaymentById(paymentId);
    if (!existingPayment) {
      return null;
    }

    // Only allow refunding completed payments
    if (existingPayment.status !== 'completed') {
      throw new Error('Only completed payments can be refunded');
    }

    const now = new Date();

    // Update payment status to refunded
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(paymentId) } as Document,
      {
        $set: {
          status: 'refunded' as PaymentStatus,
          updatedAt: now,
        },
      } as Document,
      { returnDocument: 'after' },
    );

    if (!result) {
      return null;
    }

    // If invoiceId exists, check if we need to update invoice status
    if (existingPayment.invoiceId) {
      const allPayments = await findPaymentsByInvoice(
        existingPayment.invoiceId,
        existingPayment.organizationId,
      );
      const totalPaid = allPayments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

      const invoice = await findInvoiceById(
        existingPayment.invoiceId,
        existingPayment.organizationId,
      );

      // If total paid is now less than invoice total, update invoice status back to sent
      if (invoice && totalPaid < invoice.total && invoice.status === 'paid') {
        await updateInvoiceStatus(existingPayment.invoiceId, 'sent' as InvoiceStatus).catch(
          (error) => {
            console.error('Failed to update invoice status after refund:', error);
          },
        );
      }
    }

    return result as Payment;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function listPayments(query: Record<string, unknown> = {}): Promise<Payment[]> {
  const collection = await getPaymentsCollection();

  return collection
    .find(query as Document)
    .sort({ paymentDate: -1 })
    .toArray();
}
