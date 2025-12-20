import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';
import { getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, context.organizationId);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const db = await getDb();

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    const query: Record<string, unknown> = {
      tenantId: tenant._id.toString(),
    };

    if (status && status !== 'all') {
      if (status === 'overdue') {
        query.status = { $ne: 'paid' };
        query.dueDate = { $lt: new Date() };
      } else {
        query.status = status;
      }
    }

    const invoices = await db
      .collection('invoices')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const formattedInvoices = invoices.map((inv) => ({
      id: inv._id.toString(),
      number: inv.invoiceNumber || inv.number || inv._id.toString(),
      amount: inv.total || inv.amount || 0,
      dueDate: inv.dueDate || inv.createdAt,
      status: inv.status || 'pending',
      createdAt: inv.createdAt || new Date(),
      subtotal: inv.subtotal,
      tax: inv.tax,
      vatRate: inv.vatRate,
      netIncomeBeforeVat: inv.netIncomeBeforeVat,
      netIncomeAfterVat: inv.netIncomeAfterVat,
    }));

    return NextResponse.json({ invoices: formattedInvoices });
  } catch (error) {
    console.error('Tenant invoices error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
