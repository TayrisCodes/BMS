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
    const matchQuery: Record<string, unknown> = {};

    if (buildingId) {
      matchQuery.buildingId = buildingId;
    } else if (!isSuperAdmin(context) && context.organizationId) {
      matchQuery.organizationId = context.organizationId;
    }

    // Get current occupancy stats
    const totalUnits = await db.collection('units').countDocuments(matchQuery);
    const occupiedUnits = await db.collection('units').countDocuments({
      ...matchQuery,
      status: 'occupied',
    });
    const vacantUnits = totalUnits - occupiedUnits;

    // For historical data, we'd need to track occupancy over time
    // For now, return current snapshot formatted as monthly data
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

    const currentDate = new Date();
    const chartData = [];

    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (months - 1 - i));
      const monthName = monthNames[date.getMonth()];

      // Use current occupancy for all months (can be enhanced with historical tracking)
      chartData.push({
        name: monthName,
        occupied: occupiedUnits,
        vacant: vacantUnits,
      });
    }

    return NextResponse.json({ data: chartData });
  } catch (error) {
    console.error('Occupancy chart error:', error);
    return NextResponse.json({ error: 'Failed to fetch occupancy data' }, { status: 500 });
  }
}
