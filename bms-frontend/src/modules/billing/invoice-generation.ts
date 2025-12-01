import type { Lease, BillingCycle, AdditionalCharge } from '@/lib/leases/leases';
import type { Invoice, InvoiceItem } from '@/lib/invoices/invoices';
import { listLeases, findActiveLeaseForUnit } from '@/lib/leases/leases';
import {
  findInvoicesByLease,
  createInvoice,
  type CreateInvoiceInput,
} from '@/lib/invoices/invoices';

/**
 * Calculates the number of days in a period based on billing cycle.
 */
function getDaysInBillingCycle(billingCycle: BillingCycle, periodStart: Date): number {
  const start = new Date(periodStart);
  switch (billingCycle) {
    case 'monthly': {
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    case 'quarterly': {
      const end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    case 'annually': {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    default:
      return 30; // Default to 30 days
  }
}

/**
 * Calculates prorated amount for partial periods.
 */
function calculateProratedAmount(
  baseAmount: number,
  totalDaysInPeriod: number,
  actualDaysInPeriod: number,
): number {
  if (totalDaysInPeriod <= 0 || actualDaysInPeriod <= 0) {
    return 0;
  }
  return Math.round((baseAmount * actualDaysInPeriod) / totalDaysInPeriod);
}

/**
 * Calculates period dates based on billing cycle and a reference date.
 */
function calculatePeriodDates(
  billingCycle: BillingCycle,
  referenceDate: Date,
): { periodStart: Date; periodEnd: Date } {
  const start = new Date(referenceDate);
  start.setDate(1); // Start of month
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  switch (billingCycle) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // Last day of month
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'annually':
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
  }

  return { periodStart: start, periodEnd: end };
}

/**
 * Calculates due date based on lease dueDay and issue date.
 */
function calculateDueDate(issueDate: Date, dueDay: number): Date {
  const due = new Date(issueDate);
  due.setDate(dueDay);
  // If due date is in the past, set it to next month
  if (due < issueDate) {
    due.setMonth(due.getMonth() + 1);
  }
  // Ensure due date is valid (handle months with fewer days)
  const lastDayOfMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
  if (dueDay > lastDayOfMonth) {
    due.setDate(lastDayOfMonth);
  }
  return due;
}

/**
 * Filters additional charges based on billing cycle frequency.
 */
function getChargesForBillingCycle(
  charges: AdditionalCharge[] | null | undefined,
  billingCycle: BillingCycle,
): AdditionalCharge[] {
  if (!charges || charges.length === 0) {
    return [];
  }

  return charges.filter((charge) => {
    if (charge.frequency === 'one-time') {
      return false; // Skip one-time charges in recurring invoices
    }
    return charge.frequency === billingCycle;
  });
}

/**
 * Checks if an invoice already exists for a lease and period.
 */
async function invoiceExistsForPeriod(
  leaseId: string,
  periodStart: Date,
  periodEnd: Date,
  organizationId: string,
): Promise<boolean> {
  const invoices = await findInvoicesByLease(leaseId, organizationId);
  return invoices.some((inv) => {
    const invStart = new Date(inv.periodStart);
    const invEnd = new Date(inv.periodEnd);
    return invStart.getTime() === periodStart.getTime() && invEnd.getTime() === periodEnd.getTime();
  });
}

/**
 * Generates invoice items from a lease for a given period.
 */
function generateInvoiceItemsFromLease(
  lease: Lease,
  periodStart: Date,
  periodEnd: Date,
  isPartialPeriod: boolean = false,
): InvoiceItem[] {
  const items: InvoiceItem[] = [];

  // Base rent
  const totalDaysInPeriod = getDaysInBillingCycle(lease.billingCycle, periodStart);
  const actualDaysInPeriod = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1,
  );

  let rentAmount = lease.rentAmount;
  if (isPartialPeriod) {
    rentAmount = calculateProratedAmount(lease.rentAmount, totalDaysInPeriod, actualDaysInPeriod);
  }

  items.push({
    description: 'Monthly Rent',
    amount: rentAmount,
    type: 'rent',
  });

  // Additional charges (filtered by billing cycle frequency)
  const charges = getChargesForBillingCycle(lease.additionalCharges, lease.billingCycle);
  for (const charge of charges) {
    let chargeAmount = charge.amount;
    if (isPartialPeriod) {
      chargeAmount = calculateProratedAmount(charge.amount, totalDaysInPeriod, actualDaysInPeriod);
    }

    items.push({
      description: charge.name,
      amount: chargeAmount,
      type: 'charge',
    });
  }

  return items;
}

export interface GenerateInvoicesOptions {
  organizationId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  forceRegenerate?: boolean; // If true, regenerate even if invoice exists
}

export interface GenerateInvoiceResult {
  leaseId: string;
  invoiceId: string | null;
  success: boolean;
  error?: string;
}

/**
 * Generates invoices for all active leases in an organization for a given period.
 */
export async function generateInvoicesForLeases(
  options: GenerateInvoicesOptions,
): Promise<GenerateInvoiceResult[]> {
  const { organizationId, periodStart, periodEnd, forceRegenerate = false } = options;

  // Convert dates to Date objects if strings
  const periodStartDate = typeof periodStart === 'string' ? new Date(periodStart) : periodStart;
  const periodEndDate = typeof periodEnd === 'string' ? new Date(periodEnd) : periodEnd;

  // Validate dates
  if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
    throw new Error('Invalid period dates');
  }

  if (periodEndDate <= periodStartDate) {
    throw new Error('Period end date must be after period start date');
  }

  const results: GenerateInvoiceResult[] = [];

  // Find all active leases for the organization
  const activeLeases = await listLeases({
    organizationId,
    status: 'active',
  });

  for (const lease of activeLeases) {
    try {
      // Check if invoice already exists for this period
      if (!forceRegenerate) {
        const exists = await invoiceExistsForPeriod(
          lease._id,
          periodStartDate,
          periodEndDate,
          organizationId,
        );
        if (exists) {
          results.push({
            leaseId: lease._id,
            invoiceId: null,
            success: false,
            error: 'Invoice already exists for this period',
          });
          continue;
        }
      }

      // Handle edge cases:
      // 1. Lease starts mid-cycle - prorate rent
      // 2. Lease terminates mid-cycle - prorate rent
      const leaseStart = new Date(lease.startDate);
      const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;

      // Determine actual period for this lease
      let actualPeriodStart = periodStartDate;
      let actualPeriodEnd = periodEndDate;
      let isPartialPeriod = false;

      // If lease starts after period start, use lease start
      if (leaseStart > periodStartDate) {
        actualPeriodStart = leaseStart;
        isPartialPeriod = true;
      }

      // If lease ends before period end, use lease end
      if (leaseEnd && leaseEnd < periodEndDate) {
        actualPeriodEnd = leaseEnd;
        isPartialPeriod = true;
      }

      // Skip if lease hasn't started yet or has already ended
      if (leaseEnd && leaseEnd < actualPeriodStart) {
        results.push({
          leaseId: lease._id,
          invoiceId: null,
          success: false,
          error: 'Lease has already ended',
        });
        continue;
      }

      if (leaseStart > actualPeriodEnd) {
        results.push({
          leaseId: lease._id,
          invoiceId: null,
          success: false,
          error: "Lease hasn't started yet",
        });
        continue;
      }

      // Generate invoice items
      const items = generateInvoiceItemsFromLease(
        lease,
        actualPeriodStart,
        actualPeriodEnd,
        isPartialPeriod,
      );

      // Calculate due date based on lease dueDay
      const issueDate = new Date(); // Issue date is today
      const dueDate = calculateDueDate(issueDate, lease.dueDay);

      // Calculate subtotal and total
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const tax = 0; // Tax can be configured per organization later
      const total = subtotal + tax;

      // Create invoice
      const invoiceInput: CreateInvoiceInput = {
        organizationId,
        leaseId: lease._id,
        tenantId: lease.tenantId,
        unitId: lease.unitId,
        issueDate,
        dueDate,
        periodStart: actualPeriodStart,
        periodEnd: actualPeriodEnd,
        items,
        tax,
        status: 'draft',
      };

      const invoice = await createInvoice(invoiceInput);

      results.push({
        leaseId: lease._id,
        invoiceId: invoice._id,
        success: true,
      });
    } catch (error) {
      results.push({
        leaseId: lease._id,
        invoiceId: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Generates a single invoice for a specific lease.
 * Uses the same logic as batch generation for consistency.
 */
export async function generateInvoiceForLease(
  leaseId: string,
  organizationId: string,
  periodStart?: Date | string,
  periodEnd?: Date | string,
  customItems?: InvoiceItem[],
): Promise<Invoice & { _id: string }> {
  // Find the lease
  const { findLeaseById } = await import('@/lib/leases/leases');
  const lease = await findLeaseById(leaseId, organizationId);

  if (!lease) {
    throw new Error('Lease not found');
  }

  if (lease.organizationId !== organizationId) {
    throw new Error('Lease does not belong to the same organization');
  }

  if (lease.status !== 'active') {
    throw new Error('Lease is not active');
  }

  // If custom items provided, use them
  if (customItems && customItems.length > 0) {
    const issueDate = new Date();
    const dueDate = calculateDueDate(issueDate, lease.dueDay);

    const invoiceInput: CreateInvoiceInput = {
      organizationId,
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      issueDate,
      dueDate,
      periodStart: periodStart
        ? typeof periodStart === 'string'
          ? new Date(periodStart)
          : periodStart
        : issueDate,
      periodEnd: periodEnd
        ? typeof periodEnd === 'string'
          ? new Date(periodEnd)
          : periodEnd
        : issueDate,
      items: customItems,
      tax: 0,
      status: 'draft',
    };

    return await createInvoice(invoiceInput);
  }

  // Otherwise, calculate period dates based on billing cycle
  let actualPeriodStart: Date;
  let actualPeriodEnd: Date;

  if (periodStart && periodEnd) {
    actualPeriodStart = typeof periodStart === 'string' ? new Date(periodStart) : periodStart;
    actualPeriodEnd = typeof periodEnd === 'string' ? new Date(periodEnd) : periodEnd;
  } else {
    // Calculate period dates based on billing cycle
    const today = new Date();
    const periodDates = calculatePeriodDates(lease.billingCycle, today);
    actualPeriodStart = periodDates.periodStart;
    actualPeriodEnd = periodDates.periodEnd;
  }

  // Check if invoice already exists
  const exists = await invoiceExistsForPeriod(
    leaseId,
    actualPeriodStart,
    actualPeriodEnd,
    organizationId,
  );
  if (exists) {
    throw new Error('Invoice already exists for this period');
  }

  // Handle partial periods
  const leaseStart = new Date(lease.startDate);
  const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;

  let isPartialPeriod = false;
  if (leaseStart > actualPeriodStart) {
    actualPeriodStart = leaseStart;
    isPartialPeriod = true;
  }
  if (leaseEnd && leaseEnd < actualPeriodEnd) {
    actualPeriodEnd = leaseEnd;
    isPartialPeriod = true;
  }

  // Generate invoice items
  const items = generateInvoiceItemsFromLease(
    lease,
    actualPeriodStart,
    actualPeriodEnd,
    isPartialPeriod,
  );

  // Calculate due date
  const issueDate = new Date();
  const dueDate = calculateDueDate(issueDate, lease.dueDay);

  // Create invoice
  const invoiceInput: CreateInvoiceInput = {
    organizationId,
    leaseId: lease._id,
    tenantId: lease.tenantId,
    unitId: lease.unitId,
    issueDate,
    dueDate,
    periodStart: actualPeriodStart,
    periodEnd: actualPeriodEnd,
    items,
    tax: 0,
    status: 'draft',
  };

  return await createInvoice(invoiceInput);
}
