import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { listComplaints } from '@/lib/complaints/complaints';
import { listWorkOrders } from '@/lib/work-orders/work-orders';
import { findBuildingById, findBuildingsByOrganization } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';

/**
 * GET /api/reports/operational
 * Get operational reports including complaints, work orders, and metrics.
 * Requires ORG_ADMIN, BUILDING_MANAGER, or FACILITY_MANAGER role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read complaints and work orders
    requirePermission(context, 'complaints', 'read');
    try {
      requirePermission(context, 'maintenance', 'read');
    } catch {
      // Fallback if maintenance permission doesn't exist
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId') || undefined;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
    }
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
    }

    // If buildingId is specified, validate it belongs to the organization
    let unitIds: string[] | undefined;
    if (buildingId) {
      const building = await findBuildingById(buildingId, organizationId);
      if (!building || building.organizationId !== organizationId) {
        return NextResponse.json(
          { error: 'Building not found or does not belong to organization' },
          { status: 404 },
        );
      }
      // Get all units in this building
      const units = await findUnitsByBuilding(buildingId);
      unitIds = units.map((u) => u._id);
    }

    // Build query for complaints
    const complaintQuery: Record<string, unknown> = {
      organizationId,
    };

    if (buildingId && unitIds) {
      complaintQuery.unitId = { $in: unitIds };
    }

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
      complaintQuery.createdAt = dateFilter;
    }

    // Get all complaints
    const complaints = await listComplaints(complaintQuery);

    // Build query for work orders
    const workOrderQuery: Record<string, unknown> = {
      organizationId,
    };

    if (buildingId) {
      workOrderQuery.buildingId = buildingId;
    }

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
      workOrderQuery.createdAt = dateFilter;
    }

    // Get all work orders
    const workOrders = await listWorkOrders(workOrderQuery);

    // Complaints by status
    const complaintsByStatus: Record<string, number> = {};
    for (const complaint of complaints) {
      const status = complaint.status;
      complaintsByStatus[status] = (complaintsByStatus[status] || 0) + 1;
    }

    // Complaints by category
    const complaintsByCategory: Record<string, number> = {};
    for (const complaint of complaints) {
      const category = complaint.category;
      complaintsByCategory[category] = (complaintsByCategory[category] || 0) + 1;
    }

    // Work orders by status
    const workOrdersByStatus: Record<string, number> = {};
    for (const workOrder of workOrders) {
      const status = workOrder.status;
      workOrdersByStatus[status] = (workOrdersByStatus[status] || 0) + 1;
    }

    // Work orders by priority
    const workOrdersByPriority: Record<string, number> = {};
    for (const workOrder of workOrders) {
      const priority = workOrder.priority;
      workOrdersByPriority[priority] = (workOrdersByPriority[priority] || 0) + 1;
    }

    // Calculate average complaint resolution time
    const resolvedComplaints = complaints.filter((c) => c.resolvedAt && c.createdAt);
    let averageResolutionTime = 0;
    if (resolvedComplaints.length > 0) {
      const totalResolutionTime = resolvedComplaints.reduce((sum, complaint) => {
        if (complaint.resolvedAt && complaint.createdAt) {
          const resolutionTime = complaint.resolvedAt.getTime() - complaint.createdAt.getTime();
          return sum + resolutionTime;
        }
        return sum;
      }, 0);
      averageResolutionTime = totalResolutionTime / resolvedComplaints.length;
      // Convert to days
      averageResolutionTime = averageResolutionTime / (1000 * 60 * 60 * 24);
    }

    // Calculate work order completion rate
    const completedWorkOrders = workOrders.filter((wo) => wo.status === 'completed').length;
    const workOrderCompletionRate =
      workOrders.length > 0 ? (completedWorkOrders / workOrders.length) * 100 : 0;

    // Complaints trends over time (if date range provided)
    const complaintsTrends: Array<{
      month: string; // YYYY-MM
      count: number;
      resolved: number;
    }> = [];

    if (startDate && endDate) {
      const complaintsByMonth: Record<string, { count: number; resolved: number }> = {};
      for (const complaint of complaints) {
        const month = complaint.createdAt.toISOString().substring(0, 7); // YYYY-MM
        if (!complaintsByMonth[month]) {
          complaintsByMonth[month] = { count: 0, resolved: 0 };
        }
        complaintsByMonth[month].count += 1;
        if (complaint.resolvedAt) {
          complaintsByMonth[month].resolved += 1;
        }
      }

      // Generate monthly trends
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const month = currentDate.toISOString().substring(0, 7);
        complaintsTrends.push({
          month,
          count: complaintsByMonth[month]?.count || 0,
          resolved: complaintsByMonth[month]?.resolved || 0,
        });

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Work orders trends over time (if date range provided)
    const workOrdersTrends: Array<{
      month: string; // YYYY-MM
      count: number;
      completed: number;
    }> = [];

    if (startDate && endDate) {
      const workOrdersByMonth: Record<string, { count: number; completed: number }> = {};
      for (const workOrder of workOrders) {
        const month = workOrder.createdAt.toISOString().substring(0, 7); // YYYY-MM
        if (!workOrdersByMonth[month]) {
          workOrdersByMonth[month] = { count: 0, completed: 0 };
        }
        workOrdersByMonth[month].count += 1;
        if (workOrder.status === 'completed') {
          workOrdersByMonth[month].completed += 1;
        }
      }

      // Generate monthly trends
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const month = currentDate.toISOString().substring(0, 7);
        workOrdersTrends.push({
          month,
          count: workOrdersByMonth[month]?.count || 0,
          completed: workOrdersByMonth[month]?.completed || 0,
        });

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return NextResponse.json({
      report: {
        period: {
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
        },
        buildingId: buildingId || null,
        complaints: {
          total: complaints.length,
          byStatus: Object.entries(complaintsByStatus).map(([status, count]) => ({
            status,
            count,
          })),
          byCategory: Object.entries(complaintsByCategory).map(([category, count]) => ({
            category,
            count,
          })),
          averageResolutionTime: Math.round(averageResolutionTime * 100) / 100, // Round to 2 decimal places
          resolvedCount: resolvedComplaints.length,
          trends: complaintsTrends,
        },
        workOrders: {
          total: workOrders.length,
          byStatus: Object.entries(workOrdersByStatus).map(([status, count]) => ({
            status,
            count,
          })),
          byPriority: Object.entries(workOrdersByPriority).map(([priority, count]) => ({
            priority,
            count,
          })),
          completionRate: Math.round(workOrderCompletionRate * 100) / 100, // Round to 2 decimal places
          completedCount: completedWorkOrders,
          trends: workOrdersTrends,
        },
        summary: {
          totalComplaints: complaints.length,
          totalWorkOrders: workOrders.length,
          openComplaints: complaints.filter((c) => c.status === 'open').length,
          openWorkOrders: workOrders.filter((wo) => wo.status === 'open').length,
        },
      },
    });
  } catch (error) {
    console.error('Operational report error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while generating operational report' },
      { status: 500 },
    );
  }
}
