import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/authz';
import { listTenants } from '@/lib/tenants/tenants';
import { listInvoices } from '@/lib/invoices/invoices';

/**
 * GET /api/payments/new
 * Get metadata for creating a new payment (tenants, invoices, payment methods).
 * Requires payments.record or payments.create permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to record or create payments
    // ACCOUNTANT has 'create', ORG_ADMIN and BUILDING_MANAGER have 'record'
    if (
      !hasPermission(context, 'payments', 'record') &&
      !hasPermission(context, 'payments', 'create')
    ) {
      return NextResponse.json(
        { error: 'Access denied: requires payments.record or payments.create permission' },
        { status: 403 },
      );
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const tenantId = searchParams.get('tenantId');

    // Fetch tenants
    const tenants = await listTenants({ organizationId, status: 'active' });

    // Fetch invoices if needed
    let invoices: any[] = [];
    if (invoiceId) {
      // If invoiceId is provided, fetch that specific invoice
      const { findInvoiceById } = await import('@/lib/invoices/invoices');
      const invoice = await findInvoiceById(invoiceId, organizationId);
      if (invoice) {
        invoices = [invoice];
      }
    } else if (tenantId) {
      // If tenantId is provided, fetch invoices for that tenant
      const { findInvoicesByTenant } = await import('@/lib/invoices/invoices');
      invoices = await findInvoicesByTenant(tenantId, organizationId);
    } else {
      // Fetch recent unpaid invoices
      invoices = await listInvoices({
        organizationId,
        status: { $in: ['draft', 'sent', 'pending', 'overdue'] },
      });
      // Limit to 50 most recent
      invoices = invoices.slice(0, 50);
    }

    // Payment methods
    const paymentMethods = [
      { value: 'cash', label: 'Cash' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'telebirr', label: 'Telebirr' },
      { value: 'cbe_birr', label: 'CBE Birr' },
      { value: 'chapa', label: 'Chapa' },
      { value: 'hellocash', label: 'HelloCash' },
      { value: 'other', label: 'Other' },
    ];

    return NextResponse.json({
      tenants: tenants.map((t) => ({
        _id: t._id,
        firstName: t.firstName,
        lastName: t.lastName,
        primaryPhone: t.primaryPhone,
        email: t.email,
      })),
      invoices: invoices.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        tenantId: inv.tenantId,
        total: inv.total,
        status: inv.status,
        dueDate: inv.dueDate,
      })),
      paymentMethods,
    });
  } catch (error) {
    console.error('Get payment metadata error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch payment metadata' }, { status: 500 });
  }
}
