import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv'; // csv or pdf
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const method = searchParams.get('method');
    const status = searchParams.get('status');

    const db = await getDb();

    // Build query
    const query: Record<string, unknown> = {
      tenantId: tenant._id.toString(),
      organizationId: organizationId,
    };

    if (status) {
      query.status = status;
    }

    if (method) {
      query.$or = [{ paymentMethod: method }, { method: method }];
    }

    // Date range filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    if (Object.keys(dateFilter).length > 0) {
      query.$or = query.$or || [];
      query.$and = [
        {
          $or: [{ paymentDate: dateFilter }, { createdAt: dateFilter }],
        },
      ];
      if (method) {
        query.$and.push({
          $or: [{ paymentMethod: method }, { method: method }],
        });
      }
    }

    const payments = await db
      .collection('payments')
      .find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .toArray();

    // Fetch invoice numbers
    const invoiceIds = payments.map((p) => p.invoiceId).filter((id): id is string => !!id);
    const invoiceMap: Record<string, string> = {};

    if (invoiceIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      const invoices = await db
        .collection('invoices')
        .find({
          _id: { $in: invoiceIds.map((id) => new ObjectId(id)) },
          organizationId: organizationId,
        })
        .toArray();

      invoices.forEach((inv) => {
        invoiceMap[inv._id.toString()] = inv.invoiceNumber || inv._id.toString();
      });
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Date',
        'Invoice Number',
        'Amount (ETB)',
        'Payment Method',
        'Status',
        'Reference Number',
      ];
      const rows = payments.map((payment) => {
        const paymentDate =
          payment.paymentDate instanceof Date
            ? payment.paymentDate
            : new Date(payment.paymentDate || payment.createdAt);
        return [
          paymentDate.toLocaleDateString(),
          invoiceMap[payment.invoiceId || ''] || payment.invoiceId || 'N/A',
          (payment.amount || 0).toFixed(2),
          payment.paymentMethod || payment.method || 'unknown',
          payment.status || 'pending',
          payment.referenceNumber || 'N/A',
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // For PDF, return JSON with payment data
      // PDF generation would require a library like @react-pdf/renderer
      // For now, return JSON that can be used by client-side PDF generation
      const formattedPayments = payments.map((payment) => ({
        date:
          payment.paymentDate instanceof Date
            ? payment.paymentDate.toISOString()
            : new Date(payment.paymentDate || payment.createdAt).toISOString(),
        invoiceNumber: invoiceMap[payment.invoiceId || ''] || payment.invoiceId || 'N/A',
        amount: payment.amount || 0,
        method: payment.paymentMethod || payment.method || 'unknown',
        status: payment.status || 'pending',
        referenceNumber: payment.referenceNumber || null,
      }));

      return NextResponse.json({
        payments: formattedPayments,
        tenant: {
          name: tenant.firstName + ' ' + tenant.lastName,
          phone: tenant.primaryPhone,
        },
        exportDate: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Payment export error:', error);
    return NextResponse.json({ error: 'Failed to export payments' }, { status: 500 });
  }
}

