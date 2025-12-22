import { listInvoices, type Invoice } from '@/lib/invoices/invoices';

/**
 * Aging report module for categorizing receivables by time buckets.
 */

export interface AgingBucket {
  bucket: 'current' | '31-60' | '61-90' | '90+';
  label: string;
  daysRange: { min: number; max: number | null };
  total: number;
  invoiceCount: number;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    tenantId: string;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
  }>;
}

export interface AgingReport {
  asOfDate: Date;
  organizationId: string;
  buildingId?: string | null;
  tenantId?: string | null;
  buckets: AgingBucket[];
  totalReceivables: number;
  totalInvoiceCount: number;
}

/**
 * Calculates the number of days between two dates.
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes an invoice into an aging bucket based on days overdue.
 */
function categorizeInvoice(dueDate: Date, asOfDate: Date): AgingBucket['bucket'] {
  const daysOverdue = daysBetween(dueDate, asOfDate);

  // If invoice is not yet due, it's current
  if (dueDate > asOfDate) {
    return 'current';
  }

  if (daysOverdue <= 30) {
    return 'current';
  } else if (daysOverdue <= 60) {
    return '31-60';
  } else if (daysOverdue <= 90) {
    return '61-90';
  } else {
    return '90+';
  }
}

/**
 * Generates an aging report for receivables.
 */
export async function generateAgingReport(
  organizationId: string,
  asOfDate?: Date,
  filters?: {
    buildingId?: string | null;
    tenantId?: string | null;
  },
): Promise<AgingReport> {
  const cutoffDate = asOfDate || new Date();

  // Build query for unpaid invoices
  const query: Record<string, unknown> = {
    organizationId,
    status: { $in: ['sent', 'overdue'] }, // Only unpaid invoices
  };

  if (filters?.tenantId) {
    query.tenantId = filters.tenantId;
  }

  // If buildingId is provided, we need to filter by units in that building
  if (filters?.buildingId) {
    const { findUnitsByBuilding } = await import('@/lib/units/units');
    const units = await findUnitsByBuilding(filters.buildingId);
    const unitIds = units.map((u) => u._id);
    query.unitId = { $in: unitIds };
  }

  // Get all unpaid invoices
  const invoices = await listInvoices(query);

  // Initialize buckets
  const buckets: Record<AgingBucket['bucket'], AgingBucket> = {
    current: {
      bucket: 'current',
      label: 'Current (0-30 days)',
      daysRange: { min: 0, max: 30 },
      total: 0,
      invoiceCount: 0,
      invoices: [],
    },
    '31-60': {
      bucket: '31-60',
      label: '31-60 days',
      daysRange: { min: 31, max: 60 },
      total: 0,
      invoiceCount: 0,
      invoices: [],
    },
    '61-90': {
      bucket: '61-90',
      label: '61-90 days',
      daysRange: { min: 61, max: 90 },
      total: 0,
      invoiceCount: 0,
      invoices: [],
    },
    '90+': {
      bucket: '90+',
      label: '90+ days',
      daysRange: { min: 91, max: null },
      total: 0,
      invoiceCount: 0,
      invoices: [],
    },
  };

  // Categorize invoices
  for (const invoice of invoices) {
    const bucket = categorizeInvoice(new Date(invoice.dueDate), cutoffDate);
    const daysOverdue = Math.max(0, daysBetween(new Date(invoice.dueDate), cutoffDate));

    // For current bucket, only include overdue invoices (not future-dated)
    if (bucket === 'current' && invoice.dueDate > cutoffDate) {
      continue; // Skip future invoices
    }

    const invoiceAmount = invoice.total;
    buckets[bucket].total += invoiceAmount;
    buckets[bucket].invoiceCount += 1;
    buckets[bucket].invoices.push({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId,
      amount: invoiceAmount,
      dueDate: new Date(invoice.dueDate),
      daysOverdue,
    });
  }

  // Calculate totals
  const totalReceivables = Object.values(buckets).reduce((sum, bucket) => sum + bucket.total, 0);
  const totalInvoiceCount = Object.values(buckets).reduce(
    (sum, bucket) => sum + bucket.invoiceCount,
    0,
  );

  return {
    asOfDate: cutoffDate,
    organizationId,
    buildingId: filters?.buildingId || null,
    tenantId: filters?.tenantId || null,
    buckets: Object.values(buckets),
    totalReceivables,
    totalInvoiceCount,
  };
}
