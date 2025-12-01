import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { listPayments } from '@/lib/payments/payments';
import { listInvoices } from '@/lib/invoices/invoices';
import { findBuildingById, findBuildingsByOrganization } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';
import { exportFinancialReport } from '@/modules/reports/export/csv';

/**
 * GET /api/reports/financial/export/csv
 * Export financial report as CSV.
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

    // Build query for invoices (get all invoices for ERCA compliance)
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

    // Get all invoices (not just unpaid) for complete ERCA-compliant export
    const invoices = await listInvoices(invoiceQuery);

    // Build query for payments (get all payments, not just completed)
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

    // Get all payments (for complete ERCA-compliant export)
    const payments = await listPayments(paymentQuery);

    // Generate CSV
    const csvContent = await exportFinancialReport(
      {
        invoices,
        payments,
        organizationId,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
      {
        start: startDate || new Date(0),
        end: endDate || new Date(),
      },
    );

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `financial-report-${dateStr}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Financial CSV export error', error);
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
