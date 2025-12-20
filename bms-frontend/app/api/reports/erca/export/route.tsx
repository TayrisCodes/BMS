import React from 'react';
import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  generateERCAExport,
  convertERCAToCSV,
  type ERCAExportType,
  type ERCAExportFormat,
} from '@/modules/reports/erca-export';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

/**
 * GET /api/reports/erca/export
 * Export ERCA-compliant report in CSV or PDF format.
 * Requires reports.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read reports
    requirePermission(context, 'reports', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const typeParam = searchParams.get('type') as ERCAExportType | null;
    const formatParam = searchParams.get('format') as ERCAExportFormat | null;
    const periodTypeParam = searchParams.get('periodType') as 'monthly' | 'quarterly' | null;

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    const type = typeParam || 'summary';
    const format = formatParam || 'csv';
    const periodType = periodTypeParam || 'monthly';

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const data = await generateERCAExport(organizationId, startDate, endDate, type, periodType);

    if (format === 'csv') {
      // Generate CSV
      const csv = convertERCAToCSV(data, type);
      const buffer = Buffer.from(csv, 'utf-8');

      return new Response(buffer, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="erca-${type}-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // Generate PDF
      const pdfStyles = StyleSheet.create({
        page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
        header: { fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
        subheader: { fontSize: 12, marginBottom: 8, color: '#666' },
        section: { marginBottom: 15 },
        table: { marginTop: 10 },
        tableRow: {
          flexDirection: 'row',
          borderBottom: 1,
          borderColor: '#ddd',
          paddingVertical: 5,
        },
        tableHeader: {
          flexDirection: 'row',
          borderBottom: 2,
          borderColor: '#000',
          paddingBottom: 5,
          marginBottom: 5,
          fontWeight: 'bold',
        },
        cell: { flex: 1, paddingHorizontal: 5 },
      });

      const ERCAPdf = (
        <Document>
          <Page size="A4" style={pdfStyles.page}>
            <View>
              <Text style={pdfStyles.header}>ERCA Tax Report</Text>
              <Text style={pdfStyles.subheader}>{data.organizationName}</Text>
              {data.organizationTIN && (
                <Text style={pdfStyles.subheader}>TIN: {data.organizationTIN}</Text>
              )}
              <Text style={pdfStyles.subheader}>
                Period: {startDate.toISOString().split('T')[0]} to{' '}
                {endDate.toISOString().split('T')[0]}
              </Text>
            </View>

            {type === 'invoices' && data.invoices && (
              <View style={pdfStyles.section}>
                <Text style={{ marginBottom: 10, fontWeight: 'bold' }}>Invoices</Text>
                <View style={pdfStyles.tableHeader}>
                  <Text style={pdfStyles.cell}>Invoice #</Text>
                  <Text style={pdfStyles.cell}>Date</Text>
                  <Text style={pdfStyles.cell}>Tenant</Text>
                  <Text style={pdfStyles.cell}>Amount</Text>
                  <Text style={pdfStyles.cell}>VAT</Text>
                  <Text style={pdfStyles.cell}>Total</Text>
                </View>
                {data.invoices.slice(0, 30).map((inv, idx) => (
                  <View key={idx} style={pdfStyles.tableRow}>
                    <Text style={pdfStyles.cell}>{inv.invoiceNumber}</Text>
                    <Text style={pdfStyles.cell}>{inv.issueDate}</Text>
                    <Text style={pdfStyles.cell}>{inv.tenantName}</Text>
                    <Text style={pdfStyles.cell}>{inv.subtotal.toFixed(2)}</Text>
                    <Text style={pdfStyles.cell}>{inv.vatAmount.toFixed(2)}</Text>
                    <Text style={pdfStyles.cell}>{inv.total.toFixed(2)}</Text>
                  </View>
                ))}
                {data.invoices.length > 30 && (
                  <Text style={{ marginTop: 10, fontSize: 8 }}>
                    ... and {data.invoices.length - 30} more invoices
                  </Text>
                )}
              </View>
            )}

            {type === 'payments' && data.payments && (
              <View style={pdfStyles.section}>
                <Text style={{ marginBottom: 10, fontWeight: 'bold' }}>Payments</Text>
                <View style={pdfStyles.tableHeader}>
                  <Text style={pdfStyles.cell}>Date</Text>
                  <Text style={pdfStyles.cell}>Invoice #</Text>
                  <Text style={pdfStyles.cell}>Tenant</Text>
                  <Text style={pdfStyles.cell}>Amount</Text>
                  <Text style={pdfStyles.cell}>Method</Text>
                </View>
                {data.payments.slice(0, 30).map((pay, idx) => (
                  <View key={idx} style={pdfStyles.tableRow}>
                    <Text style={pdfStyles.cell}>{pay.paymentDate}</Text>
                    <Text style={pdfStyles.cell}>{pay.invoiceNumber}</Text>
                    <Text style={pdfStyles.cell}>{pay.tenantName}</Text>
                    <Text style={pdfStyles.cell}>{pay.amount.toFixed(2)}</Text>
                    <Text style={pdfStyles.cell}>{pay.paymentMethod}</Text>
                  </View>
                ))}
                {data.payments.length > 30 && (
                  <Text style={{ marginTop: 10, fontSize: 8 }}>
                    ... and {data.payments.length - 30} more payments
                  </Text>
                )}
              </View>
            )}

            {type === 'summary' && data.summary && (
              <View style={pdfStyles.section}>
                <Text style={{ marginBottom: 10, fontWeight: 'bold' }}>Summary</Text>
                <View style={pdfStyles.tableHeader}>
                  <Text style={pdfStyles.cell}>Period</Text>
                  <Text style={pdfStyles.cell}>Invoices</Text>
                  <Text style={pdfStyles.cell}>Revenue</Text>
                  <Text style={pdfStyles.cell}>VAT</Text>
                  <Text style={pdfStyles.cell}>Payments</Text>
                </View>
                {data.summary.map((sum, idx) => (
                  <View key={idx} style={pdfStyles.tableRow}>
                    <Text style={pdfStyles.cell}>{sum.period}</Text>
                    <Text style={pdfStyles.cell}>{sum.totalInvoices}</Text>
                    <Text style={pdfStyles.cell}>{sum.totalRevenue.toFixed(2)}</Text>
                    <Text style={pdfStyles.cell}>{sum.totalVAT.toFixed(2)}</Text>
                    <Text style={pdfStyles.cell}>{sum.totalPayments.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Page>
        </Document>
      );

      const doc = await pdf(ERCAPdf).toBuffer();

      return new Response(doc, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="erca-${type}-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.pdf"`,
        },
      });
    }
  } catch (error) {
    console.error('Export ERCA report error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while exporting ERCA report' },
      { status: 500 },
    );
  }
}
