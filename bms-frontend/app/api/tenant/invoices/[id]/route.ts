import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findInvoiceById } from '@/lib/invoices/invoices';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id: invoiceId } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Fetch invoice
    const invoice = await findInvoiceById(invoiceId, organizationId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate invoice belongs to tenant
    if (invoice.tenantId !== tenant._id.toString()) {
      return NextResponse.json(
        { error: 'Access denied: Invoice does not belong to you' },
        { status: 403 },
      );
    }

    // Validate invoice belongs to organization
    if (invoice.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Invoice does not belong to your organization' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        items: invoice.items,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        vatRate: invoice.vatRate,
        total: invoice.total,
        netIncomeBeforeVat: invoice.netIncomeBeforeVat,
        netIncomeAfterVat: invoice.netIncomeAfterVat,
        status: invoice.status,
        paidAt: invoice.paidAt,
      },
    });
  } catch (error) {
    console.error('Tenant invoice detail error', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}
