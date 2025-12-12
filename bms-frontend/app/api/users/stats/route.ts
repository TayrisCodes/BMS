import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { isSuperAdmin } from '@/lib/auth/authz';
import { withOptionalOrganizationScope } from '@/lib/organizations/scoping';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();

    // Build query based on user role
    let query: Record<string, unknown> = {};

    // SUPER_ADMIN can see all users, others see only their org
    if (!isSuperAdmin(context)) {
      query = withOptionalOrganizationScope(context, {});
    }

    // Use aggregation for efficient counting
    const stats = await db
      .collection('users')
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Also get total count
    const total = await db.collection('users').countDocuments(query);

    // Convert stats array to object
    const statsMap: Record<string, number> = {
      total,
      active: 0,
      invited: 0,
      inactive: 0,
      suspended: 0,
    };

    stats.forEach((stat) => {
      const status = stat._id || 'unknown';
      if (status in statsMap) {
        statsMap[status] = stat.count;
      }
    });

    return NextResponse.json({
      stats: statsMap,
    });
  } catch (error) {
    console.error('Users stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
}





