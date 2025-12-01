import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';
import { isSuperAdmin } from '@/lib/auth/authz';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const buildingId = searchParams.get('buildingId');
    const months = parseInt(searchParams.get('months') || '6');

    // Calculate date range (last N months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Build query
    const matchQuery: Record<string, unknown> = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed',
    };

    if (buildingId) {
      matchQuery.buildingId = buildingId;
    } else if (!isSuperAdmin(context) && context.organizationId) {
      matchQuery.organizationId = context.organizationId;
    }

    // Aggregate payments by month
    const revenueData = await db
      .collection('payments')
      .aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ])
      .toArray();

    // Format data for chart
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const chartData = revenueData.map((item) => ({
      name: monthNames[item._id.month - 1],
      value: item.total,
    }));

    // Fill in missing months with 0
    const fullChartData = [];
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (months - 1 - i));
      const monthName = monthNames[date.getMonth()];

      const existing = chartData.find((d) => d.name === monthName);
      fullChartData.push(existing || { name: monthName, value: 0 });
    }

    return NextResponse.json({ data: fullChartData });
  } catch (error) {
    console.error('Revenue chart error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}
