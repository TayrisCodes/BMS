import { findTenantById } from '@/lib/tenants/tenants';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitById } from '@/lib/units/units';
import { findOrganizationById } from '@/lib/organizations/organizations';
import type { Invoice } from '@/lib/invoices/invoices';
import type { Payment } from '@/lib/payments/payments';

/**
 * Escape CSV field value (handles commas, quotes, newlines)
 */
function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date for CSV (YYYY-MM-DD)
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  const [datePart] = date.toISOString().split('T');
  return datePart ?? '';
}

/**
 * Format currency for CSV
 */
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return amount.toFixed(2);
}

/**
 * Generate CSV content from array of rows
 */
function generateCSV(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCSVField).join(',')).join('\n');
}

export interface FinancialReportData {
  invoices: Invoice[];
  payments: Payment[];
  organizationId: string;
  period: {
    startDate: Date | null;
    endDate: Date | null;
  };
}

/**
 * Export financial report to CSV format (ERCA-compliant)
 */
export async function exportFinancialReport(
  data: FinancialReportData,
  dateRange: { start: Date; end: Date },
): Promise<string> {
  const { invoices, payments, organizationId, period } = data;

  // Get organization details
  const organization = await findOrganizationById(organizationId);
  const orgName = organization?.name || 'Unknown Organization';
  // TIN number would be in settings or contactInfo if available
  const orgTin = (organization?.settings as { tinNumber?: string })?.tinNumber || '';

  const rows: string[][] = [];

  // Metadata rows
  rows.push(['Financial Report']);
  rows.push(['Organization', orgName]);
  rows.push(['TIN Number', orgTin]);
  rows.push(['Report Generation Date', formatDate(new Date())]);
  rows.push([
    'Period',
    period.startDate ? formatDate(period.startDate) : 'All Time',
    'to',
    period.endDate ? formatDate(period.endDate) : 'All Time',
  ]);
  rows.push([]); // Empty row

  // Invoices section
  rows.push(['INVOICES']);
  rows.push([
    'Invoice Number',
    'Issue Date',
    'Due Date',
    'Tenant Name',
    'Tenant Phone',
    'Unit',
    'Subtotal',
    'Tax',
    'Total',
    'Status',
    'Paid Date',
  ]);

  // Fetch tenant and unit details for invoices
  for (const invoice of invoices) {
    const tenant = await findTenantById(invoice.tenantId);
    const unit = await findUnitById(invoice.unitId);
    const tenantName =
      tenant && `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
        ? `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
        : 'Unknown Tenant';
    const tenantPhone = tenant?.primaryPhone || '';
    const unitName = unit ? `${unit.buildingId}/${unit.unitNumber}` : 'Unknown Unit';

    rows.push([
      invoice.invoiceNumber,
      formatDate(invoice.issueDate),
      formatDate(invoice.dueDate),
      tenantName,
      tenantPhone,
      unitName,
      formatCurrency(invoice.subtotal),
      formatCurrency(invoice.tax || 0),
      formatCurrency(invoice.total),
      invoice.status,
      invoice.paidAt ? formatDate(invoice.paidAt) : '',
    ]);
  }

  rows.push([]); // Empty row

  // Payments section
  rows.push(['PAYMENTS']);
  rows.push([
    'Payment Date',
    'Tenant Name',
    'Tenant Phone',
    'Invoice Number',
    'Amount',
    'Payment Method',
    'Reference Number',
    'Status',
  ]);

  // Fetch tenant details for payments
  for (const payment of payments) {
    const tenant = await findTenantById(payment.tenantId);
    const tenantName =
      tenant && `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
        ? `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
        : 'Unknown Tenant';
    const tenantPhone = tenant?.primaryPhone || '';

    // Get invoice number if available
    let invoiceNumber = '';
    if (payment.invoiceId) {
      const invoice = invoices.find((inv) => inv._id === payment.invoiceId);
      invoiceNumber = invoice?.invoiceNumber || '';
    }

    rows.push([
      formatDate(payment.paymentDate),
      tenantName,
      tenantPhone,
      invoiceNumber,
      formatCurrency(payment.amount),
      payment.paymentMethod,
      payment.referenceNumber || '',
      payment.status,
    ]);
  }

  return generateCSV(rows);
}

export interface OccupancyReportData {
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    maintenanceUnits: number;
    reservedUnits: number;
    occupancyRate: number;
    vacancyRate: number;
  };
  occupancyByBuilding: Array<{
    buildingId: string;
    buildingName: string;
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    maintenanceUnits: number;
    reservedUnits: number;
    occupancyRate: number;
    vacancyRate: number;
  }> | null;
  organizationId: string;
}

/**
 * Export occupancy report to CSV format
 */
export async function exportOccupancyReport(data: OccupancyReportData): Promise<string> {
  const { summary, occupancyByBuilding, organizationId } = data;

  // Get organization details
  const organization = await findOrganizationById(organizationId);
  const orgName = organization?.name || 'Unknown Organization';

  const rows: string[][] = [];

  // Metadata rows
  rows.push(['Occupancy Report']);
  rows.push(['Organization', orgName]);
  rows.push(['Report Generation Date', formatDate(new Date())]);
  rows.push([]); // Empty row

  // Summary section
  rows.push(['SUMMARY']);
  rows.push(['Metric', 'Value']);
  rows.push(['Total Units', summary.totalUnits.toString()]);
  rows.push(['Occupied Units', summary.occupiedUnits.toString()]);
  rows.push(['Available Units', summary.availableUnits.toString()]);
  rows.push(['Maintenance Units', summary.maintenanceUnits.toString()]);
  rows.push(['Reserved Units', summary.reservedUnits.toString()]);
  rows.push(['Occupancy Rate (%)', summary.occupancyRate.toFixed(2)]);
  rows.push(['Vacancy Rate (%)', summary.vacancyRate.toFixed(2)]);
  rows.push([]); // Empty row

  // Building breakdown
  if (occupancyByBuilding && occupancyByBuilding.length > 0) {
    rows.push(['OCCUPANCY BY BUILDING']);
    rows.push([
      'Building Name',
      'Total Units',
      'Occupied',
      'Available',
      'Maintenance',
      'Reserved',
      'Occupancy Rate (%)',
      'Vacancy Rate (%)',
    ]);

    for (const building of occupancyByBuilding) {
      rows.push([
        building.buildingName,
        building.totalUnits.toString(),
        building.occupiedUnits.toString(),
        building.availableUnits.toString(),
        building.maintenanceUnits.toString(),
        building.reservedUnits.toString(),
        building.occupancyRate.toFixed(2),
        building.vacancyRate.toFixed(2),
      ]);
    }
  }

  return generateCSV(rows);
}

export interface OperationalReportData {
  complaints: Array<{
    _id: string;
    tenantId: string;
    unitId: string;
    category: string;
    title: string;
    status: string;
    priority: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }>;
  workOrders: Array<{
    _id: string;
    buildingId: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  organizationId: string;
  period: {
    startDate: Date | null;
    endDate: Date | null;
  };
}

/**
 * Export operational report to CSV format
 */
export async function exportOperationalReport(
  data: OperationalReportData,
  dateRange: { start: Date; end: Date },
): Promise<string> {
  const { complaints, workOrders, organizationId, period } = data;

  // Get organization details
  const organization = await findOrganizationById(organizationId);
  const orgName = organization?.name || 'Unknown Organization';

  const rows: string[][] = [];

  // Metadata rows
  rows.push(['Operational Report']);
  rows.push(['Organization', orgName]);
  rows.push(['Report Generation Date', formatDate(new Date())]);
  rows.push([
    'Period',
    period.startDate ? formatDate(period.startDate) : 'All Time',
    'to',
    period.endDate ? formatDate(period.endDate) : 'All Time',
  ]);
  rows.push([]); // Empty row

  // Complaints section
  rows.push(['COMPLAINTS']);
  rows.push([
    'Complaint ID',
    'Category',
    'Title',
    'Tenant Name',
    'Unit',
    'Status',
    'Priority',
    'Created Date',
    'Resolved Date',
    'Resolution Time (Days)',
  ]);

  for (const complaint of complaints) {
    const tenant = await findTenantById(complaint.tenantId);
    const unit = await findUnitById(complaint.unitId);
    const tenantName =
      tenant && `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
        ? `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
        : 'Unknown Tenant';
    const unitName = unit ? `${unit.buildingId}/${unit.unitNumber}` : 'Unknown Unit';

    let resolutionTime = '';
    if (complaint.resolvedAt && complaint.createdAt) {
      const days =
        (complaint.resolvedAt.getTime() - complaint.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      resolutionTime = days.toFixed(1);
    }

    rows.push([
      complaint._id,
      complaint.category,
      complaint.title,
      tenantName,
      unitName,
      complaint.status,
      complaint.priority,
      formatDate(complaint.createdAt),
      complaint.resolvedAt ? formatDate(complaint.resolvedAt) : '',
      resolutionTime,
    ]);
  }

  rows.push([]); // Empty row

  // Work Orders section
  rows.push(['WORK ORDERS']);
  rows.push([
    'Work Order ID',
    'Title',
    'Category',
    'Building',
    'Status',
    'Priority',
    'Created Date',
    'Completed Date',
    'Completion Time (Days)',
  ]);

  for (const workOrder of workOrders) {
    const building = await findBuildingById(workOrder.buildingId, organizationId);
    const buildingName = building?.name || 'Unknown Building';

    let completionTime = '';
    if (workOrder.completedAt && workOrder.createdAt) {
      const days =
        (workOrder.completedAt.getTime() - workOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      completionTime = days.toFixed(1);
    }

    rows.push([
      workOrder._id,
      workOrder.title,
      workOrder.category,
      buildingName,
      workOrder.status,
      workOrder.priority,
      formatDate(workOrder.createdAt),
      workOrder.completedAt ? formatDate(workOrder.completedAt) : '',
      completionTime,
    ]);
  }

  return generateCSV(rows);
}
