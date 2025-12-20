import { listInvoices } from '@/lib/invoices/invoices';
import { getPaymentsCollection } from '@/lib/payments/payments';
import { findOrganizationById } from '@/lib/organizations/organizations';

/**
 * ERCA (Ethiopian Revenue and Customs Authority) export module.
 * Generates ERCA-compliant reports for tax reporting.
 */

export type ERCAExportType = 'invoices' | 'payments' | 'summary';
export type ERCAExportFormat = 'csv' | 'pdf';

export interface ERCAInvoiceRecord {
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  tenantName: string;
  tenantTIN?: string | null;
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  total: number;
  currency: string;
  status: string;
  paidDate?: string | null; // YYYY-MM-DD
}

export interface ERCAPaymentRecord {
  paymentDate: string; // YYYY-MM-DD
  invoiceNumber: string;
  tenantName: string;
  tenantTIN?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  referenceNumber?: string | null;
  status: string;
}

export interface ERCASummaryRecord {
  period: string; // YYYY-MM or YYYY-Q1, etc.
  totalInvoices: number;
  totalRevenue: number;
  totalVAT: number;
  totalPayments: number;
  currency: string;
}

export interface ERCAExportData {
  organizationName: string;
  organizationTIN?: string | null;
  periodStart: Date;
  periodEnd: Date;
  invoices?: ERCAInvoiceRecord[];
  payments?: ERCAPaymentRecord[];
  summary?: ERCASummaryRecord[];
}

/**
 * Generates ERCA-compliant invoice records.
 */
export async function generateERCAInvoiceRecords(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<ERCAInvoiceRecord[]> {
  const organization = await findOrganizationById(organizationId);
  const { findTenantById } = await import('@/lib/tenants/tenants');

  // Get all invoices in the date range
  const invoices = await listInvoices({
    organizationId,
    issueDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const records: ERCAInvoiceRecord[] = [];

  for (const invoice of invoices) {
    // Get tenant information
    const tenant = await findTenantById(invoice.tenantId, organizationId);
    const tenantName = tenant
      ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.phone
      : 'Unknown Tenant';
    const tenantTIN = tenant?.tin || null;

    const formatDate = (date: Date | string): string => {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    records.push({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: formatDate(invoice.issueDate),
      dueDate: formatDate(invoice.dueDate),
      tenantName,
      tenantTIN,
      subtotal: invoice.subtotal,
      vatAmount: invoice.tax || 0,
      vatRate: invoice.vatRate || 15,
      total: invoice.total,
      currency: invoice.currency || 'ETB',
      status: invoice.status,
      paidDate: invoice.paidAt ? formatDate(invoice.paidAt) : null,
    });
  }

  return records.sort((a, b) => a.issueDate.localeCompare(b.issueDate));
}

/**
 * Generates ERCA-compliant payment records.
 */
export async function generateERCAPaymentRecords(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<ERCAPaymentRecord[]> {
  const { findTenantById } = await import('@/lib/tenants/tenants');
  const { findInvoiceById } = await import('@/lib/invoices/invoices');
  const paymentsCollection = await getPaymentsCollection();

  // Get all completed payments in the date range
  const payments = await paymentsCollection
    .find({
      organizationId,
      status: 'completed',
      paymentDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
    .sort({ paymentDate: 1 })
    .toArray();

  const records: ERCAPaymentRecord[] = [];

  for (const payment of payments) {
    // Get tenant information
    const tenant = await findTenantById(payment.tenantId, organizationId);
    const tenantName = tenant
      ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.phone
      : 'Unknown Tenant';
    const tenantTIN = tenant?.tin || null;

    // Get invoice information
    let invoiceNumber = 'N/A';
    if (payment.invoiceId) {
      const invoice = await findInvoiceById(payment.invoiceId, organizationId);
      if (invoice) {
        invoiceNumber = invoice.invoiceNumber;
      }
    }

    const formatDate = (date: Date | string): string => {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    };

    records.push({
      paymentDate: formatDate(payment.paymentDate),
      invoiceNumber,
      tenantName,
      tenantTIN,
      amount: payment.amount,
      currency: payment.currency || 'ETB',
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber || null,
      status: payment.status,
    });
  }

  return records.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
}

/**
 * Generates ERCA-compliant summary records (monthly/quarterly).
 */
export async function generateERCASummaryRecords(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  periodType: 'monthly' | 'quarterly' = 'monthly',
): Promise<ERCASummaryRecord[]> {
  const invoices = await listInvoices({
    organizationId,
    issueDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const paymentsCollection = await getPaymentsCollection();
  const payments = await paymentsCollection
    .find({
      organizationId,
      status: 'completed',
      paymentDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
    .toArray();

  // Group by period
  const summaryByPeriod = new Map<string, ERCASummaryRecord>();

  // Process invoices
  for (const invoice of invoices) {
    const period = formatPeriod(new Date(invoice.issueDate), periodType);
    const existing = summaryByPeriod.get(period);

    if (existing) {
      existing.totalInvoices += 1;
      existing.totalRevenue += invoice.total;
      existing.totalVAT += invoice.tax || 0;
    } else {
      summaryByPeriod.set(period, {
        period,
        totalInvoices: 1,
        totalRevenue: invoice.total,
        totalVAT: invoice.tax || 0,
        totalPayments: 0,
        currency: invoice.currency || 'ETB',
      });
    }
  }

  // Process payments
  for (const payment of payments) {
    const period = formatPeriod(new Date(payment.paymentDate), periodType);
    const existing = summaryByPeriod.get(period);

    if (existing) {
      existing.totalPayments += payment.amount;
    } else {
      summaryByPeriod.set(period, {
        period,
        totalInvoices: 0,
        totalRevenue: 0,
        totalVAT: 0,
        totalPayments: payment.amount,
        currency: payment.currency || 'ETB',
      });
    }
  }

  return Array.from(summaryByPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Formats a date into a period string.
 */
function formatPeriod(date: Date, periodType: 'monthly' | 'quarterly'): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (periodType === 'monthly') {
    return `${year}-${month.toString().padStart(2, '0')}`;
  } else {
    const quarter = Math.floor((month - 1) / 3) + 1;
    return `${year}-Q${quarter}`;
  }
}

/**
 * Generates ERCA export data.
 */
export async function generateERCAExport(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  type: ERCAExportType,
  periodType?: 'monthly' | 'quarterly',
): Promise<ERCAExportData> {
  const organization = await findOrganizationById(organizationId);

  const data: ERCAExportData = {
    organizationName: organization?.name || 'Organization',
    organizationTIN: (organization?.settings?.tin as string | null) || null,
    periodStart: startDate,
    periodEnd: endDate,
  };

  if (type === 'invoices' || type === 'summary') {
    data.invoices = await generateERCAInvoiceRecords(organizationId, startDate, endDate);
  }

  if (type === 'payments' || type === 'summary') {
    data.payments = await generateERCAPaymentRecords(organizationId, startDate, endDate);
  }

  if (type === 'summary') {
    data.summary = await generateERCASummaryRecords(
      organizationId,
      startDate,
      endDate,
      periodType || 'monthly',
    );
  }

  return data;
}

/**
 * Converts ERCA export data to CSV format.
 */
export function convertERCAToCSV(data: ERCAExportData, type: ERCAExportType): string {
  const lines: string[] = [];

  // Header
  lines.push(`ERCA Tax Report - ${data.organizationName}`);
  if (data.organizationTIN) {
    lines.push(`TIN: ${data.organizationTIN}`);
  }
  lines.push(
    `Period: ${data.periodStart.toISOString().split('T')[0]} to ${data.periodEnd.toISOString().split('T')[0]}`,
  );
  lines.push('');

  if (type === 'invoices' && data.invoices) {
    // Invoice CSV
    lines.push(
      'Invoice Number,Issue Date,Due Date,Tenant Name,Tenant TIN,Subtotal,VAT Amount,VAT Rate,Total,Currency,Status,Paid Date',
    );
    for (const record of data.invoices) {
      lines.push(
        [
          record.invoiceNumber,
          record.issueDate,
          record.dueDate,
          `"${record.tenantName}"`,
          record.tenantTIN || '',
          record.subtotal.toFixed(2),
          record.vatAmount.toFixed(2),
          record.vatRate.toFixed(2),
          record.total.toFixed(2),
          record.currency,
          record.status,
          record.paidDate || '',
        ].join(','),
      );
    }
  } else if (type === 'payments' && data.payments) {
    // Payment CSV
    lines.push(
      'Payment Date,Invoice Number,Tenant Name,Tenant TIN,Amount,Currency,Payment Method,Reference Number,Status',
    );
    for (const record of data.payments) {
      lines.push(
        [
          record.paymentDate,
          record.invoiceNumber,
          `"${record.tenantName}"`,
          record.tenantTIN || '',
          record.amount.toFixed(2),
          record.currency,
          record.paymentMethod,
          record.referenceNumber || '',
          record.status,
        ].join(','),
      );
    }
  } else if (type === 'summary' && data.summary) {
    // Summary CSV
    lines.push('Period,Total Invoices,Total Revenue,Total VAT,Total Payments,Currency');
    for (const record of data.summary) {
      lines.push(
        [
          record.period,
          record.totalInvoices,
          record.totalRevenue.toFixed(2),
          record.totalVAT.toFixed(2),
          record.totalPayments.toFixed(2),
          record.currency,
        ].join(','),
      );
    }
  }

  return lines.join('\n');
}

