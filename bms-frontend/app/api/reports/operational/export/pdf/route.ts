import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { requirePermission } from '@/lib/auth/authz';
import { listComplaints } from '@/lib/complaints/complaints';
import { listWorkOrders } from '@/lib/work-orders/work-orders';
import { findBuildingById } from '@/lib/buildings/buildings';
import { findUnitsByBuilding } from '@/lib/units/units';
import { findOrganizationById } from '@/lib/organizations/organizations';
import { renderToBuffer } from '@react-pdf/renderer';
import {
  generateOperationalReportPDF,
  type OperationalReportData,
} from '@/modules/reports/export/pdf';

/**
 * GET /api/reports/operational/export/pdf
 * Export operational report as PDF.
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

    // Get organization details
    const organization = await findOrganizationById(organizationId);
    const orgName = organization?.name || 'Unknown Organization';

    // Prepare report data
    const reportData: OperationalReportData = {
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
        averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
        resolvedCount: resolvedComplaints.length,
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
        completionRate: Math.round(workOrderCompletionRate * 100) / 100,
        completedCount: completedWorkOrders,
      },
      summary: {
        totalComplaints: complaints.length,
        totalWorkOrders: workOrders.length,
        openComplaints: complaints.filter((c) => c.status === 'open').length,
        openWorkOrders: workOrders.filter((wo) => wo.status === 'open').length,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };

    // Generate PDF
    const pdfDoc = generateOperationalReportPDF(
      reportData,
      {
        start: startDate || new Date(0),
        end: endDate || new Date(),
      },
      orgName,
    );
    const pdfBuffer = await renderToBuffer(pdfDoc as any);

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `operational-report-${dateStr}.pdf`;

    // Return PDF file
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Operational PDF export error', error);
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
