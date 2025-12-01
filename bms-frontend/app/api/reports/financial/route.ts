import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { listPayments } from '@/lib/payments/payments';
import { listInvoices, findOverdueInvoices } from '@/lib/invoices/invoices';
import { findBuildingById, findBuildingsByOrganization } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';

/**
 * GET /api/reports/financial
 * Get financial reports including revenue, receivables, payment breakdown, and monthly trends.
 * Requires ORG_ADMIN, ACCOUNTANT, or BUILDING_MANAGER role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read financial reports
    // ORG_ADMIN, ACCOUNTANT, and BUILDING_MANAGER should have invoices.read and payments.read
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

    // Build query for payments
    const paymentQuery: Record<string, unknown> = {
      organizationId,
      status: 'completed', // Only count completed payments as revenue
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
      // Get all invoices for these units
      const invoiceQuery: Record<string, unknown> = {
        organizationId,
        unitId: { $in: unitIds },
      };
      const invoices = await listInvoices(invoiceQuery);
      const invoiceIds = invoices.map((inv) => inv._id);
      paymentQuery.invoiceId = { $in: invoiceIds };
    }

    // Get all completed payments
    const payments = await listPayments(paymentQuery);

    // Calculate total revenue (sum of completed payments)
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

    // Payment breakdown by method
    const paymentBreakdown: Record<string, { count: number; total: number }> = {};
    for (const payment of payments) {
      const method = payment.paymentMethod;
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { count: 0, total: 0 };
      }
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].total += payment.amount;
    }

    // Build query for invoices
    const invoiceQuery: Record<string, unknown> = {
      organizationId,
      status: { $in: ['sent', 'overdue'] }, // Unpaid invoices
    };

    if (buildingId && unitIds) {
      invoiceQuery.unitId = { $in: unitIds };
    }

    // Get unpaid invoices
    const unpaidInvoices = await listInvoices(invoiceQuery);

    // Calculate outstanding receivables (sum of unpaid invoices)
    const outstandingReceivables = unpaidInvoices.reduce((sum, invoice) => sum + invoice.total, 0);

    // Get overdue invoices
    const overdueInvoices = await findOverdueInvoices(organizationId);
    const overdueAmount = overdueInvoices
      .filter((inv) => {
        // Filter by building if specified
        if (buildingId && unitIds && !unitIds.includes(inv.unitId)) {
          return false;
        }
        // Filter by date range if specified
        if (startDate && inv.dueDate < startDate) {
          return false;
        }
        if (endDate && inv.dueDate > endDate) {
          return false;
        }
        return true;
      })
      .reduce((sum, inv) => sum + inv.total, 0);

    // Monthly trends (optional, for charts)
    const monthlyTrends: Array<{
      month: string; // YYYY-MM
      revenue: number;
      receivables: number;
      paymentsCount: number;
    }> = [];

    if (startDate && endDate) {
      // Group payments by month
      const paymentsByMonth: Record<string, { revenue: number; count: number }> = {};
      for (const payment of payments) {
        const month = payment.paymentDate.toISOString().substring(0, 7); // YYYY-MM
        if (!paymentsByMonth[month]) {
          paymentsByMonth[month] = { revenue: 0, count: 0 };
        }
        paymentsByMonth[month].revenue += payment.amount;
        paymentsByMonth[month].count += 1;
      }

      // Group invoices by month
      const invoicesByMonth: Record<string, number> = {};
      for (const invoice of unpaidInvoices) {
        const month = invoice.dueDate.toISOString().substring(0, 7); // YYYY-MM
        if (!invoicesByMonth[month]) {
          invoicesByMonth[month] = 0;
        }
        invoicesByMonth[month] += invoice.total;
      }

      // Generate monthly trends
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const month = currentDate.toISOString().substring(0, 7);
        monthlyTrends.push({
          month,
          revenue: paymentsByMonth[month]?.revenue || 0,
          receivables: invoicesByMonth[month] || 0,
          paymentsCount: paymentsByMonth[month]?.count || 0,
        });

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return NextResponse.json({
      report: {
        period: {
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
        },
        buildingId: buildingId || null,
        totalRevenue,
        outstandingReceivables,
        overdueAmount,
        paymentBreakdown: Object.entries(paymentBreakdown).map(([method, data]) => ({
          method,
          count: data.count,
          total: data.total,
          percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
        })),
        monthlyTrends,
        summary: {
          totalPayments: payments.length,
          totalUnpaidInvoices: unpaidInvoices.length,
          totalOverdueInvoices: overdueInvoices.filter((inv) => {
            if (buildingId && unitIds && !unitIds.includes(inv.unitId)) {
              return false;
            }
            if (startDate && inv.dueDate < startDate) {
              return false;
            }
            if (endDate && inv.dueDate > endDate) {
              return false;
            }
            return true;
          }).length,
        },
      },
    });
  } catch (error) {
    console.error('Financial report error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating financial report' },
      { status: 500 },
    );
  }
}
