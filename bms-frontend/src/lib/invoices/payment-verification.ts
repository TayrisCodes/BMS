import { findInvoicesByTenant } from './invoices';
import type { Invoice } from './invoices';

export interface PaymentVerificationResult {
  hasUnpaidInvoices: boolean;
  hasOverdueInvoices: boolean;
  previousMonthPaid: boolean;
  unpaidInvoices: {
    count: number;
    totalAmount: number;
    invoices: Array<{
      _id: string;
      invoiceNumber: string;
      total: number;
      dueDate: Date;
      status: string;
    }>;
  };
  overdueInvoices: {
    count: number;
    totalAmount: number;
    invoices: Array<{
      _id: string;
      invoiceNumber: string;
      total: number;
      dueDate: Date;
      status: string;
    }>;
  };
  previousMonth: {
    paid: boolean;
    unpaidCount: number;
    unpaidInvoices: Array<{
      _id: string;
      invoiceNumber: string;
      total: number;
      dueDate: Date;
      status: string;
    }>;
  };
  warnings: string[];
}

/**
 * Verifies tenant payment status before generating a new invoice.
 * Checks for unpaid invoices, overdue invoices, and previous month payment status.
 *
 * @param tenantId - The tenant ID to verify
 * @param organizationId - The organization ID for scoping
 * @returns Payment verification result with warnings
 */
export async function verifyTenantPaymentStatus(
  tenantId: string,
  organizationId: string,
): Promise<PaymentVerificationResult> {
  // Get all invoices for this tenant
  const allInvoices = await findInvoicesByTenant(tenantId, organizationId);

  // Separate invoices by status
  const unpaidInvoices = allInvoices.filter(
    (inv) => inv.status === 'overdue' || inv.status === 'sent',
  );

  // Calculate overdue invoices (unpaid and past due date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueInvoices = unpaidInvoices.filter((inv) => {
    const dueDate = new Date(inv.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  });

  // Calculate totals
  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Check previous month payment status
  const now = new Date();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const previousMonthInvoices = allInvoices.filter((inv) => {
    const periodStart = new Date(inv.periodStart);
    return periodStart >= previousMonthStart && periodStart <= previousMonthEnd;
  });

  const previousMonthPaid =
    previousMonthInvoices.length === 0 ||
    previousMonthInvoices.every((inv) => inv.status === 'paid');
  const previousMonthUnpaid = previousMonthInvoices.filter((inv) => inv.status !== 'paid');

  // Generate warnings
  const warnings: string[] = [];

  if (unpaidInvoices.length > 0) {
    warnings.push(
      `Tenant has ${unpaidInvoices.length} unpaid invoice(s) totaling ${unpaidTotal.toLocaleString(
        'en-ET',
        {
          style: 'currency',
          currency: 'ETB',
        },
      )}`,
    );
  }

  if (overdueInvoices.length > 0) {
    warnings.push(
      `Tenant has ${overdueInvoices.length} overdue invoice(s) totaling ${overdueTotal.toLocaleString(
        'en-ET',
        {
          style: 'currency',
          currency: 'ETB',
        },
      )}`,
    );
  }

  if (!previousMonthPaid && previousMonthInvoices.length > 0) {
    warnings.push(
      `Previous month's invoice (${previousMonthUnpaid.length} unpaid) has not been paid`,
    );
  }

  return {
    hasUnpaidInvoices: unpaidInvoices.length > 0,
    hasOverdueInvoices: overdueInvoices.length > 0,
    previousMonthPaid,
    unpaidInvoices: {
      count: unpaidInvoices.length,
      totalAmount: unpaidTotal,
      invoices: unpaidInvoices.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        dueDate: inv.dueDate,
        status: inv.status,
      })),
    },
    overdueInvoices: {
      count: overdueInvoices.length,
      totalAmount: overdueTotal,
      invoices: overdueInvoices.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        dueDate: inv.dueDate,
        status: inv.status,
      })),
    },
    previousMonth: {
      paid: previousMonthPaid,
      unpaidCount: previousMonthUnpaid.length,
      unpaidInvoices: previousMonthUnpaid.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        dueDate: inv.dueDate,
        status: inv.status,
      })),
    },
    warnings,
  };
}
