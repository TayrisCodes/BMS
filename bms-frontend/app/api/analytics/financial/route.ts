import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can view financial analytics
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';

    const db = await getDb();
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Payment method distribution
    const paymentMethodDistribution = await db
      .collection('payments')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$provider',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ])
      .toArray();

    // Payment success rate
    const totalPayments = await db.collection('payments').countDocuments({
      createdAt: { $gte: startDate },
    });
    const successfulPayments = await db.collection('payments').countDocuments({
      createdAt: { $gte: startDate },
      status: 'completed',
    });
    const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

    // Outstanding invoices
    const outstandingInvoices = await db
      .collection('invoices')
      .aggregate([
        {
          $match: {
            status: { $in: ['pending', 'overdue'] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ])
      .toArray();

    // Invoice status distribution
    const invoiceStatusDistribution = await db
      .collection('invoices')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ])
      .toArray();

    // Total revenue from payments
    const totalRevenue = await db
      .collection('payments')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    return NextResponse.json({
      paymentMethods: paymentMethodDistribution.map((item) => ({
        provider: item._id || 'Unknown',
        count: item.count,
        totalAmount: item.totalAmount,
      })),
      paymentSuccess: {
        total: totalPayments,
        successful: successfulPayments,
        failed: totalPayments - successfulPayments,
        successRate: Math.round(successRate * 100) / 100,
      },
      outstandingInvoices: outstandingInvoices[0] || {
        count: 0,
        totalAmount: 0,
      },
      invoiceStatus: invoiceStatusDistribution.map((item) => ({
        status: item._id,
        count: item.count,
        totalAmount: item.totalAmount,
      })),
      totalRevenue: totalRevenue[0]?.total || 0,
      period,
    });
  } catch (error) {
    console.error('Financial analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch financial analytics' }, { status: 500 });
  }
}





