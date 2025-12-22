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

    const db = await getDb();

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const invoiceId = searchParams.get('invoiceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const method = searchParams.get('method');
    const status = searchParams.get('status');

    // Build query
    const query: Record<string, unknown> = {
      tenantId: tenant._id.toString(),
      organizationId: organizationId,
    };

    if (invoiceId) {
      query.invoiceId = invoiceId;
    }

    if (status) {
      query.status = status;
    }

    if (method) {
      // Handle both paymentMethod and method fields
      query.$or = [{ paymentMethod: method }, { method: method }];
    }

    // Date range filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end date
      dateFilter.$lte = end;
    }
    if (Object.keys(dateFilter).length > 0) {
      query.$or = query.$or || [];
      // Apply date filter to both paymentDate and createdAt
      const andConditions: Record<string, unknown>[] = [
        {
          $or: [{ paymentDate: dateFilter }, { createdAt: dateFilter }],
        },
      ];
      // If we already have $or for method, combine them
      if (method) {
        andConditions.push({
          $or: [{ paymentMethod: method }, { method: method }],
        });
      }
      query.$and = andConditions;
    }

    const payments = await db
      .collection('payments')
      .find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    // Fetch invoice numbers for payments
    const invoiceIds = payments.map((p) => p.invoiceId).filter((id): id is string => !!id);
    const invoiceMap: Record<string, string> = {};

    if (invoiceIds.length > 0) {
      const invoices = await db
        .collection('invoices')
        .find({
          _id: {
            $in: invoiceIds.map((id) => {
              const { ObjectId } = require('mongodb');
              return new ObjectId(id);
            }),
          },
          organizationId: organizationId,
        })
        .toArray();

      invoices.forEach((inv) => {
        invoiceMap[inv._id.toString()] = inv.invoiceNumber || inv._id.toString();
      });
    }

    const formattedPayments = payments.map((payment) => ({
      id: payment._id.toString(),
      _id: payment._id.toString(),
      amount: payment.amount || 0,
      invoiceId: payment.invoiceId || null,
      invoiceNumber: invoiceMap[payment.invoiceId || ''] || payment.invoiceId || 'N/A',
      method: payment.paymentMethod || payment.method || 'unknown',
      paymentMethod: payment.paymentMethod || payment.method || 'unknown',
      status: payment.status || 'pending',
      paymentDate: payment.paymentDate || payment.createdAt || new Date(),
      referenceNumber: payment.referenceNumber || null,
      createdAt: payment.createdAt || new Date(),
      receiptUrl: payment.receiptUrl,
    }));

    return NextResponse.json({ payments: formattedPayments });
  } catch (error) {
    console.error('Tenant payments error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
