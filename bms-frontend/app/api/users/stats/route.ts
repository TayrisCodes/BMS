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
    const searchParams = request.nextUrl.searchParams;
    const breakdown = searchParams.get('breakdown'); // 'organization' for org breakdown
    const includeRole = searchParams.get('role') === 'true'; // Include role distribution

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

    const response: Record<string, unknown> = {
      stats: statsMap,
    };

    // Add organization breakdown for SUPER_ADMIN
    if (isSuperAdmin(context) && breakdown === 'organization') {
      const orgStats = await db
        .collection('users')
        .aggregate([
          { $match: query },
          {
            $group: {
              _id: '$organizationId',
              total: { $sum: 1 },
              active: {
                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
              },
              invited: {
                $sum: { $cond: [{ $eq: ['$status', 'invited'] }, 1, 0] },
              },
              inactive: {
                $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] },
              },
              suspended: {
                $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] },
              },
            },
          },
        ])
        .toArray();

      // Get organization names
      const { ObjectId } = await import('mongodb');
      const orgIds = orgStats.map((s) => s._id).filter(Boolean);
      const orgs = await db
        .collection('organizations')
        .find({
          _id: { $in: orgIds.map((id) => new ObjectId(id as string)) },
        })
        .toArray();

      const orgMap = new Map<string, string>();
      orgs.forEach((org: any) => {
        orgMap.set(org._id.toString(), org.name || 'Unknown');
      });

      response.byOrganization = orgStats.map((stat) => ({
        organizationId: stat._id,
        organizationName: orgMap.get(stat._id as string) || 'Unknown',
        stats: {
          total: stat.total,
          active: stat.active,
          invited: stat.invited,
          inactive: stat.inactive,
          suspended: stat.suspended,
        },
      }));
    }

    // Add role distribution
    if (includeRole) {
      const roleStats = await db
        .collection('users')
        .aggregate([
          { $match: query },
          { $unwind: '$roles' },
          {
            $group: {
              _id: '$roles',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const roleMap: Record<string, number> = {};
      roleStats.forEach((stat) => {
        roleMap[stat._id as string] = stat.count;
      });

      response.byRole = roleMap;
    }

    // Add trends (last 30/90 days) for SUPER_ADMIN
    if (isSuperAdmin(context)) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [last30Days, last90Days] = await Promise.all([
        db.collection('users').countDocuments({
          ...query,
          createdAt: { $gte: thirtyDaysAgo },
        }),
        db.collection('users').countDocuments({
          ...query,
          createdAt: { $gte: ninetyDaysAgo },
        }),
      ]);

      response.trends = {
        last30Days,
        last90Days,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Users stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
}
