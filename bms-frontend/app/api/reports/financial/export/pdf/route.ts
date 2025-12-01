import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { listPayments } from '@/lib/payments/payments';
import { listInvoices } from '@/lib/invoices/invoices';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';
import { findOrganizationById } from '@/lib/organizations/organizations';
import { renderToBuffer } from '@react-pdf/renderer';
import { generateFinancialReportPDF, type FinancialReportData } from '@/modules/reports/export/pdf';

/**
 * GET /api/reports/financial/export/pdf
 * Export financial report as PDF.
 * Requires ORG_ADMIN, ACCOUNTANT, or BUILDING_MANAGER role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read financial reports
    requirePermission(context, 'invoices', 'read');
    requirePermission(context, 'payments', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId') || undefined;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
    }
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
    }

    // If buildingId is specified, validate it belongs to the organization
    let unitIds: string[] | undefined;
    if (buildingId) {
      const building = await findBuildingById(buildingId, organizationId);
      if (!building || building.organizationId !== organizationId) {
        return NextResponse.json(
          { error: 'Building not found or does not belong to organization' },
          { status: 404 },
        );
      }
      // Get all units in this building
      const units = await findUnitsByBuilding(buildingId);
      unitIds = units.map((u) => u._id);
    }

    // Build query for invoices
    const invoiceQuery: Record<string, unknown> = {
      organizationId,
    };

    if (buildingId && unitIds) {
      invoiceQuery.unitId = { $in: unitIds };
    }

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
      invoiceQuery.issueDate = dateFilter;
    }

    // Get all invoices
    const invoices = await listInvoices(invoiceQuery);

    // Build query for payments
    const paymentQuery: Record<string, unknown> = {
      organizationId,
    };

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
      paymentQuery.paymentDate = dateFilter;
    }

    // If buildingId is specified, filter payments by unitId via invoices
    if (buildingId && unitIds) {
      const invoiceIds = invoices.map((inv) => inv._id);
      paymentQuery.invoiceId = { $in: invoiceIds };
    }

    // Get all payments
    const payments = await listPayments(paymentQuery);

    // Calculate summary data
    const totalRevenue = payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0);

    const outstandingReceivables = invoices
      .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, invoice) => sum + invoice.total, 0);

    const overdueAmount = invoices
      .filter((inv) => {
        if (inv.status !== 'overdue') return false;
        if (startDate && inv.dueDate < startDate) return false;
        if (endDate && inv.dueDate > endDate) return false;
        return true;
      })
      .reduce((sum, inv) => sum + inv.total, 0);

    // Payment breakdown
    const paymentBreakdownMap: Record<string, { count: number; total: number }> = {};
    for (const payment of payments.filter((p) => p.status === 'completed')) {
      const method = payment.paymentMethod;
      if (!paymentBreakdownMap[method]) {
        paymentBreakdownMap[method] = { count: 0, total: 0 };
      }
      paymentBreakdownMap[method].count += 1;
      paymentBreakdownMap[method].total += payment.amount;
    }

    const paymentBreakdown = Object.entries(paymentBreakdownMap).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
    }));

    // Get organization details
    const organization = await findOrganizationById(organizationId);
    const orgName = organization?.name || 'Unknown Organization';
    const orgTin = (organization?.settings as { tinNumber?: string })?.tinNumber || '';

    // Prepare report data
    const reportData: FinancialReportData = {
      invoices,
      payments,
      organizationId,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        totalRevenue,
        outstandingReceivables,
        overdueAmount,
        totalPayments: payments.length,
        totalUnpaidInvoices: invoices.filter(
          (inv) => inv.status === 'sent' || inv.status === 'overdue',
        ).length,
        totalOverdueInvoices: invoices.filter((inv) => inv.status === 'overdue').length,
      },
      paymentBreakdown,
    };

    // Generate PDF
    const pdfDoc = generateFinancialReportPDF(
      reportData,
      {
        start: startDate || new Date(0),
        end: endDate || new Date(),
      },
      orgName,
      orgTin,
    );

    const pdfBuffer = await renderToBuffer(pdfDoc as any);

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `financial-report-${dateStr}.pdf`;

    // Return PDF file
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Financial PDF export error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while exporting financial report' },
      { status: 500 },
    );
  }
}
