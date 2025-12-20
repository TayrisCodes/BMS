import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findTenantById } from '@/lib/tenants/tenants';
import { findLeasesByTenant } from '@/lib/leases/leases';
import { findInvoicesByTenant } from '@/lib/invoices/invoices';

/**
 * GET /api/tenants/[id]/payment-status
 * Get tenant's payment status including unpaid invoices, overdue invoices, and active leases.
 * Requires invoices.read permission.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read invoices
    requirePermission(context, 'invoices', 'read');

    const tenantId = params.id;
    const organizationId = context.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Verify tenant exists and belongs to organization
    const tenant = await findTenantById(tenantId, organizationId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get all invoices for this tenant
    const allInvoices = await findInvoicesByTenant(tenantId, organizationId);

    // Separate invoices by status
    const unpaidInvoices = allInvoices.filter(
      (inv) => inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'sent',
    );
    const overdueInvoices = allInvoices.filter((inv) => {
      if (inv.status === 'paid') return false;
      const dueDate = new Date(inv.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
    const paidInvoices = allInvoices.filter((inv) => inv.status === 'paid');

    // Calculate totals
    const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Get previous month's invoice payment status
    const now = new Date();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const previousMonthInvoices = allInvoices.filter((inv) => {
      const periodStart = new Date(inv.periodStart);
      return periodStart >= previousMonthStart && periodStart <= previousMonthEnd;
    });

    const previousMonthPaid = previousMonthInvoices.every((inv) => inv.status === 'paid');
    const previousMonthUnpaid = previousMonthInvoices.filter((inv) => inv.status !== 'paid');

    // Get active leases for this tenant
    const allLeases = await findLeasesByTenant(tenantId, organizationId);
    const activeLeases = allLeases.filter((lease) => lease.status === 'active');

    return NextResponse.json({
      tenant: {
        _id: tenant._id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        primaryPhone: tenant.primaryPhone,
        email: tenant.email,
      },
      paymentStatus: {
        unpaidInvoices: {
          count: unpaidInvoices.length,
          totalAmount: unpaidTotal,
          invoices: unpaidInvoices.map((inv) => ({
            _id: inv._id,
            invoiceNumber: inv.invoiceNumber,
            total: inv.total,
            dueDate: inv.dueDate,
            status: inv.status,
            periodStart: inv.periodStart,
            periodEnd: inv.periodEnd,
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
            periodStart: inv.periodStart,
            periodEnd: inv.periodEnd,
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
        summary: {
          totalInvoices: allInvoices.length,
          paidInvoices: paidInvoices.length,
          unpaidInvoices: unpaidInvoices.length,
          overdueInvoices: overdueInvoices.length,
        },
      },
      activeLeases: activeLeases.map((lease) => ({
        _id: lease._id,
        unitId: lease.unitId,
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: lease.rentAmount,
        billingCycle: lease.billingCycle,
        dueDay: lease.dueDay,
        status: lease.status,
      })),
    });
  } catch (error) {
    console.error('Get tenant payment status error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching tenant payment status' },
      { status: 500 },
    );
  }
}
