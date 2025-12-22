import {
  calculateInvoiceTotals,
  createInvoice,
  findInvoicesByLease,
  findOverdueInvoices,
  updateInvoice,
  type InvoiceItem,
} from '@/lib/invoices/invoices';
import {
  advanceInvoiceDate,
  findLeaseById,
  getNextInvoiceDate,
  listLeases,
  type Lease,
} from '@/lib/leases/leases';

const DAY_MS = 1000 * 60 * 60 * 24;

function getPaymentDueDays(lease: Lease): number {
  return (
    lease.paymentDueDays ??
    lease.penaltyConfig?.paymentDueDays ??
    lease.penaltyConfig?.gracePeriodDays ??
    7
  );
}

function buildInvoiceItems(lease: Lease, includeDeposit: boolean): InvoiceItem[] {
  const items: InvoiceItem[] = [
    {
      description: 'Rent',
      amount: lease.rentAmount ?? lease.terms.rent,
      type: 'rent',
    },
  ];

  if (lease.terms.serviceCharges) {
    items.push({
      description: 'Service Charges',
      amount: lease.terms.serviceCharges,
      type: 'charge',
    });
  }

  if (includeDeposit && lease.terms.deposit) {
    items.push({
      description: 'Security Deposit',
      amount: lease.terms.deposit,
      type: 'deposit',
    });
  }

  if (lease.additionalCharges?.length) {
    lease.additionalCharges.forEach((charge) => {
      items.push({
        description: charge.name,
        amount: charge.amount,
        type: 'charge',
      });
    });
  }

  return items;
}

function normalizeVat(
  lease: Lease,
  items: InvoiceItem[],
): { items: InvoiceItem[]; vatRate?: number | null } {
  const vatRate = lease.terms.vatRate ?? lease.vatRate ?? 15;
  if (!lease.terms.vatIncluded) {
    return { items, vatRate };
  }

  const factor = 1 + vatRate / 100;
  const netItems = items.map((item) =>
    item.type === 'rent' || item.type === 'charge'
      ? { ...item, amount: Math.round(item.amount / factor) }
      : item,
  );
  return { items: netItems, vatRate };
}

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

function computeLateFee(lease: Lease, amountBase: number, dueDate: Date, asOf: Date): number {
  const cfg = lease.penaltyConfig;
  if (!cfg || !cfg.lateFeeRatePerDay) return 0;
  const grace = cfg.lateFeeGraceDays ?? cfg.gracePeriodDays ?? 0;
  const cap = cfg.lateFeeCapDays ?? null;
  const daysLateRaw = Math.floor((asOf.getTime() - dueDate.getTime()) / DAY_MS);
  const daysLate = Math.max(0, daysLateRaw - grace);
  if (daysLate <= 0) return 0;
  const effectiveDays = cap ? Math.min(daysLate, cap) : daysLate;
  const fee = amountBase * cfg.lateFeeRatePerDay * effectiveDays;
  return Math.round(fee);
}

async function applyLateFeesForOrg(organizationId: string, asOf: Date): Promise<void> {
  const overdue = await findOverdueInvoices(organizationId, asOf);

  for (const invoice of overdue) {
    const lease = await findLeaseById(invoice.leaseId, organizationId);
    if (!lease) continue;

    const baseAmount = invoice.total ?? invoice.subtotal;
    const penaltyAmount = computeLateFee(lease, baseAmount, new Date(invoice.dueDate), asOf);
    const itemsWithoutPenalty = invoice.items.filter((i) => i.type !== 'penalty');

    // Idempotent: overwrite the penalty line with recalculated amount
    const updatedItems: InvoiceItem[] =
      penaltyAmount > 0
        ? [
            ...itemsWithoutPenalty,
            {
              description: `Late fee (${lease.penaltyConfig?.lateFeeRatePerDay ?? 0} per day)`,
              amount: penaltyAmount,
              type: 'penalty',
            },
          ]
        : itemsWithoutPenalty;

    await updateInvoice(invoice._id, {
      items: updatedItems,
      status: 'overdue',
      vatRate: invoice.vatRate ?? lease.terms.vatRate ?? lease.vatRate,
    }).catch((err) => {
      console.error('Failed to apply late fee for invoice', invoice._id, err);
    });
  }
}

export async function runLeaseInvoicingForOrg(organizationId: string, asOf: Date = new Date()) {
  // 1) Apply late fees to existing overdue invoices
  await applyLateFeesForOrg(organizationId, asOf);

  // 2) Generate invoices for leases whose nextInvoiceDate is due
  const dueLeases = await listLeases({
    organizationId,
    status: 'active',
    nextInvoiceDate: { $lte: asOf },
  });

  for (const lease of dueLeases) {
    const periodEnd = getNextInvoiceDate(lease);
    const periodStart = lease.lastInvoicedAt
      ? new Date(lease.lastInvoicedAt)
      : new Date(lease.startDate);

    const alreadyExists = await invoiceExistsForPeriod(
      lease._id,
      periodStart,
      periodEnd,
      organizationId,
    );
    if (alreadyExists) {
      continue;
    }

    const includeDeposit = !lease.lastInvoicedAt && !!lease.terms.deposit;
    const rawItems = buildInvoiceItems(lease, includeDeposit);
    const { items, vatRate } = normalizeVat(lease, rawItems);
    const totals = calculateInvoiceTotals(items, undefined, vatRate ?? undefined);

    const issueDate = asOf;
    const dueInDays = getPaymentDueDays(lease);
    const dueDate = new Date(issueDate.getTime() + dueInDays * DAY_MS);

    await createInvoice({
      organizationId,
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      issueDate,
      dueDate,
      periodStart,
      periodEnd,
      items,
      vatRate: vatRate ?? undefined,
      status: 'sent',
      tax: totals.tax,
    }).catch((err) => {
      console.error('Failed to create invoice for lease', lease._id, err);
    });

    // Advance lease billing pointers
    const nextInvoiceDate = advanceInvoiceDate(periodEnd, lease.billingCycle);
    await updateInvoicePointers(lease._id, nextInvoiceDate, periodEnd);
  }
}

async function updateInvoicePointers(
  leaseId: string,
  nextInvoiceDate: Date,
  lastInvoicedAt: Date,
): Promise<void> {
  await import('@/lib/leases/leases').then(async ({ updateLease }) => {
    await updateLease(leaseId, {
      nextInvoiceDate,
      lastInvoicedAt,
    }).catch((err: unknown) => {
      console.error('Failed to advance lease invoice pointers', leaseId, err);
    });
  });
}
