import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { getUsersCollection } from '@/lib/auth/users';
import { getDb } from '@/lib/db';

const ALLOWED_ROLES = ['FACILITY_MANAGER', 'ORG_ADMIN', 'BUILDING_MANAGER', 'SUPER_ADMIN'];

/**
 * GET /api/technicians
 * Returns technicians in the organization with workload stats (counts of work orders by status).
 * Requires maintenance.read (or complaints.read fallback) or roles in ALLOWED_ROLES.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission/role
    try {
      requirePermission(context, 'maintenance', 'read');
    } catch {
      try {
        requirePermission(context, 'complaints', 'read');
      } catch {
        const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
        if (!hasRole) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const usersCollection = await getUsersCollection();
    const technicians = await usersCollection
      .find({
        organizationId,
        roles: 'TECHNICIAN',
      })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        status: 1,
        lastLoginAt: 1,
        createdAt: 1,
      })
      .toArray();

    const technicianIds = technicians.map((t) => t._id?.toString()).filter(Boolean);

    // If no technicians, return early
    if (technicianIds.length === 0) {
      return NextResponse.json({ technicians: [] });
    }

    const db = await getDb();
    const workloadAgg = await db
      .collection('workOrders')
      .aggregate([
        {
          $match: {
            organizationId,
            assignedTo: { $in: technicianIds },
          },
        },
        {
          $group: {
            _id: '$assignedTo',
            open: {
              $sum: {
                $cond: [{ $eq: ['$status', 'open'] }, 1, 0],
              },
            },
            assigned: {
              $sum: {
                $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0],
              },
            },
            inProgress: {
              $sum: {
                $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0],
              },
            },
            completed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
              },
            },
            cancelled: {
              $sum: {
                $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0],
              },
            },
            lastWorkOrderAt: { $max: '$updatedAt' },
          },
        },
      ])
      .toArray();

    const workloadMap = new Map<
      string,
      {
        open: number;
        assigned: number;
        inProgress: number;
        completed: number;
        cancelled: number;
        lastWorkOrderAt?: Date;
      }
    >();

    workloadAgg.forEach((w) => {
      workloadMap.set(w._id as string, {
        open: w.open || 0,
        assigned: w.assigned || 0,
        inProgress: w.inProgress || 0,
        completed: w.completed || 0,
        cancelled: w.cancelled || 0,
        lastWorkOrderAt: w.lastWorkOrderAt,
      });
    });

    return NextResponse.json({
      technicians: technicians.map((tech) => {
        const workload = workloadMap.get(tech._id.toString()) || {
          open: 0,
          assigned: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          lastWorkOrderAt: null,
        };
        const activeWork = workload.open + workload.assigned + workload.inProgress;
        return {
          id: tech._id.toString(),
          name: tech.name || null,
          email: tech.email || null,
          phone: tech.phone,
          status: tech.status || 'active',
          lastLoginAt: tech.lastLoginAt || null,
          createdAt: tech.createdAt || null,
          workload: {
            ...workload,
            active: activeWork,
          },
        };
      }),
    });
  } catch (error) {
    console.error('Get technicians error:', error);
    return NextResponse.json({ error: 'Failed to fetch technicians' }, { status: 500 });
  }
}

