import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Invoice } from '@/lib/invoices/invoices';
import type { Payment } from '@/lib/payments/payments';

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottom: '1 solid #ccc',
    paddingBottom: 5,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #eee',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 5,
  },
  tableCellSmall: {
    flex: 0.8,
    paddingHorizontal: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
    borderTop: '1 solid #eee',
    paddingTop: 10,
  },
  summaryBox: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    marginBottom: 15,
    border: '1 solid #ddd',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontWeight: 'bold',
  },
  summaryValue: {
    textAlign: 'right',
  },
});

/**
 * Format date for PDF (YYYY-MM-DD)
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  const [datePart] = date.toISOString().split('T');
  return datePart ?? 'N/A';
}

/**
 * Format currency for PDF (ETB)
 */
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return `ETB ${amount.toFixed(2)}`;
}

export interface FinancialReportData {
  invoices: Invoice[];
  payments: Payment[];
  organizationId: string;
  period: {
    startDate: Date | null;
    endDate: Date | null;
  };
  summary: {
    totalRevenue: number;
    outstandingReceivables: number;
    overdueAmount: number;
    totalPayments: number;
    totalUnpaidInvoices: number;
    totalOverdueInvoices: number;
  };
  paymentBreakdown: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
}

/**
 * Generate Financial Report PDF
 */
export function generateFinancialReportPDF(
  data: FinancialReportData,
  dateRange: { start: Date; end: Date },
  organizationName: string,
  organizationTin?: string,
): any {
  const { invoices, payments, period, summary, paymentBreakdown } = data;

  // @ts-ignore
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Financial Report</Text>
          <Text style={styles.subtitle}>{organizationName}</Text>
          {organizationTin && <Text style={styles.subtitle}>TIN: {organizationTin}</Text>}
          <Text style={styles.subtitle}>
            Period: {period.startDate ? formatDate(period.startDate) : 'All Time'} to{' '}
            {period.endDate ? formatDate(period.endDate) : 'All Time'}
          </Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date())}</Text>
        </View>

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Revenue:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.totalRevenue)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Outstanding Receivables:</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.outstandingReceivables)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Overdue Amount:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.overdueAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Payments:</Text>
              <Text style={styles.summaryValue}>{summary.totalPayments}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Unpaid Invoices:</Text>
              <Text style={styles.summaryValue}>{summary.totalUnpaidInvoices}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Overdue Invoices:</Text>
              <Text style={styles.summaryValue}>{summary.totalOverdueInvoices}</Text>
            </View>
          </View>
        </View>

        {/* Payment Breakdown */}
        {paymentBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Breakdown by Method</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={styles.tableCell}>Method</Text>
                <Text style={styles.tableCell}>Count</Text>
                <Text style={styles.tableCell}>Total Amount</Text>
                <Text style={styles.tableCell}>Percentage</Text>
              </View>
              {paymentBreakdown.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.method}</Text>
                  <Text style={styles.tableCell}>{item.count}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(item.total)}</Text>
                  <Text style={styles.tableCell}>{item.percentage.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This report is generated for ERCA compliance and audit purposes.</Text>
        </View>
      </Page>

      {/* Invoices Page */}
      {invoices.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Invoices</Text>
          </View>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellSmall}>Invoice #</Text>
              <Text style={styles.tableCellSmall}>Issue Date</Text>
              <Text style={styles.tableCellSmall}>Due Date</Text>
              <Text style={styles.tableCell}>Total</Text>
              <Text style={styles.tableCellSmall}>Status</Text>
            </View>
            {invoices.slice(0, 30).map((invoice) => (
              <View key={invoice._id} style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>{invoice.invoiceNumber}</Text>
                <Text style={styles.tableCellSmall}>{formatDate(invoice.issueDate)}</Text>
                <Text style={styles.tableCellSmall}>{formatDate(invoice.dueDate)}</Text>
                <Text style={styles.tableCell}>{formatCurrency(invoice.total)}</Text>
                <Text style={styles.tableCellSmall}>{invoice.status}</Text>
              </View>
            ))}
            {invoices.length > 30 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>... and {invoices.length - 30} more invoices</Text>
              </View>
            )}
          </View>
        </Page>
      )}

      {/* Payments Page */}
      {payments.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Payments</Text>
          </View>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellSmall}>Date</Text>
              <Text style={styles.tableCell}>Amount</Text>
              <Text style={styles.tableCell}>Method</Text>
              <Text style={styles.tableCell}>Reference</Text>
              <Text style={styles.tableCellSmall}>Status</Text>
            </View>
            {payments.slice(0, 30).map((payment) => (
              <View key={payment._id} style={styles.tableRow}>
                <Text style={styles.tableCellSmall}>{formatDate(payment.paymentDate)}</Text>
                <Text style={styles.tableCell}>{formatCurrency(payment.amount)}</Text>
                <Text style={styles.tableCell}>{payment.paymentMethod}</Text>
                <Text style={styles.tableCell}>{payment.referenceNumber || 'N/A'}</Text>
                <Text style={styles.tableCellSmall}>{payment.status}</Text>
              </View>
            ))}
            {payments.length > 30 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>... and {payments.length - 30} more payments</Text>
              </View>
            )}
          </View>
        </Page>
      )}
    </Document>
  );
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
}

/**
 * Generate Occupancy Report PDF
 */
export function generateOccupancyReportPDF(
  data: OccupancyReportData,
  organizationName: string,
): any {
  const { summary, occupancyByBuilding } = data;

  // @ts-ignore
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Occupancy Report</Text>
          <Text style={styles.subtitle}>{organizationName}</Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date())}</Text>
        </View>

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Units:</Text>
              <Text style={styles.summaryValue}>{summary.totalUnits}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Occupied Units:</Text>
              <Text style={styles.summaryValue}>{summary.occupiedUnits}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Available Units:</Text>
              <Text style={styles.summaryValue}>{summary.availableUnits}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Maintenance Units:</Text>
              <Text style={styles.summaryValue}>{summary.maintenanceUnits}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reserved Units:</Text>
              <Text style={styles.summaryValue}>{summary.reservedUnits}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Occupancy Rate:</Text>
              <Text style={styles.summaryValue}>{summary.occupancyRate.toFixed(2)}%</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vacancy Rate:</Text>
              <Text style={styles.summaryValue}>{summary.vacancyRate.toFixed(2)}%</Text>
            </View>
          </View>
        </View>

        {/* Building Breakdown */}
        {occupancyByBuilding && occupancyByBuilding.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Occupancy by Building</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={styles.tableCell}>Building</Text>
                <Text style={styles.tableCellSmall}>Total</Text>
                <Text style={styles.tableCellSmall}>Occupied</Text>
                <Text style={styles.tableCellSmall}>Available</Text>
                <Text style={styles.tableCellSmall}>Maintenance</Text>
                <Text style={styles.tableCellSmall}>Reserved</Text>
                <Text style={styles.tableCellSmall}>Occupancy %</Text>
              </View>
              {occupancyByBuilding.map((building) => (
                <View key={building.buildingId} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{building.buildingName}</Text>
                  <Text style={styles.tableCellSmall}>{building.totalUnits}</Text>
                  <Text style={styles.tableCellSmall}>{building.occupiedUnits}</Text>
                  <Text style={styles.tableCellSmall}>{building.availableUnits}</Text>
                  <Text style={styles.tableCellSmall}>{building.maintenanceUnits}</Text>
                  <Text style={styles.tableCellSmall}>{building.reservedUnits}</Text>
                  <Text style={styles.tableCellSmall}>{building.occupancyRate.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Occupancy Report - {organizationName}</Text>
        </View>
      </Page>
    </Document>
  );
}

export interface OperationalReportData {
  complaints: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    averageResolutionTime: number;
    resolvedCount: number;
  };
  workOrders: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
    completionRate: number;
    completedCount: number;
  };
  summary: {
    totalComplaints: number;
    totalWorkOrders: number;
    openComplaints: number;
    openWorkOrders: number;
  };
  period: {
    startDate: Date | null;
    endDate: Date | null;
  };
}

/**
 * Generate Operational Report PDF
 */
export function generateOperationalReportPDF(
  data: OperationalReportData,
  dateRange: { start: Date; end: Date },
  organizationName: string,
): any {
  const { complaints, workOrders, summary, period } = data;

  // @ts-ignore
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Operational Report</Text>
          <Text style={styles.subtitle}>{organizationName}</Text>
          <Text style={styles.subtitle}>
            Period: {period.startDate ? formatDate(period.startDate) : 'All Time'} to{' '}
            {period.endDate ? formatDate(period.endDate) : 'All Time'}
          </Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date())}</Text>
        </View>

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Complaints:</Text>
              <Text style={styles.summaryValue}>{summary.totalComplaints}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Open Complaints:</Text>
              <Text style={styles.summaryValue}>{summary.openComplaints}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Work Orders:</Text>
              <Text style={styles.summaryValue}>{summary.totalWorkOrders}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Open Work Orders:</Text>
              <Text style={styles.summaryValue}>{summary.openWorkOrders}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg Resolution Time:</Text>
              <Text style={styles.summaryValue}>
                {complaints.averageResolutionTime.toFixed(1)} days
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Work Order Completion Rate:</Text>
              <Text style={styles.summaryValue}>{workOrders.completionRate.toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* Complaints Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complaints by Status</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Status</Text>
              <Text style={styles.tableCell}>Count</Text>
            </View>
            {complaints.byStatus.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.status}</Text>
                <Text style={styles.tableCell}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complaints by Category</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Category</Text>
              <Text style={styles.tableCell}>Count</Text>
            </View>
            {complaints.byCategory.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.category}</Text>
                <Text style={styles.tableCell}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Work Orders Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Orders by Status</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Status</Text>
              <Text style={styles.tableCell}>Count</Text>
            </View>
            {workOrders.byStatus.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.status}</Text>
                <Text style={styles.tableCell}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Orders by Priority</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Priority</Text>
              <Text style={styles.tableCell}>Count</Text>
            </View>
            {workOrders.byPriority.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.priority}</Text>
                <Text style={styles.tableCell}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Operational Report - {organizationName}</Text>
        </View>
      </Page>
    </Document>
  );
}
