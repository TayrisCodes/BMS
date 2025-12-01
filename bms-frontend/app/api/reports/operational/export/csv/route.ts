import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { listComplaints } from '@/lib/complaints/complaints';
import { listWorkOrders } from '@/lib/work-orders/work-orders';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';
import { exportOperationalReport } from '@/modules/reports/export/csv';

/**
 * GET /api/reports/operational/export/csv
 * Export operational report as CSV.
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

    // Generate CSV
    const csvContent = await exportOperationalReport(
      {
        complaints: complaints.map((c) => ({
          _id: String(c._id),
          tenantId: c.tenantId,
          unitId: c.unitId || '',
          category: String(c.category),
          title: c.title,
          status: String(c.status),
          priority: String(c.priority),
          createdAt: c.createdAt,
          resolvedAt: c.resolvedAt || null,
        })),
        workOrders: workOrders.map((wo) => ({
          _id: String(wo._id),
          buildingId: wo.buildingId,
          title: wo.title,
          category: String(wo.category),
          status: String(wo.status),
          priority: String(wo.priority),
          createdAt: wo.createdAt,
          completedAt: wo.completedAt || null,
        })),
        organizationId,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
      {
        start: startDate || new Date(0),
        end: endDate || new Date(),
      },
    );

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `operational-report-${dateStr}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Operational CSV export error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while exporting operational report' },
      { status: 500 },
    );
  }
}
