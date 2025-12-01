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

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    const payments = await db
      .collection('payments')
      .find({
        tenantId: tenant._id.toString(),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const formattedPayments = payments.map((payment) => ({
      id: payment._id.toString(),
      amount: payment.amount || 0,
      invoiceNumber: payment.invoiceNumber || payment.invoiceId || 'N/A',
      method: payment.method || 'unknown',
      status: payment.status || 'pending',
      createdAt: payment.createdAt || new Date(),
      receiptUrl: payment.receiptUrl,
    }));

    return NextResponse.json({ payments: formattedPayments });
  } catch (error) {
    console.error('Tenant payments error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
