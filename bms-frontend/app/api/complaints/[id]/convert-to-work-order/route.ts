import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findComplaintById, updateComplaint, type Complaint } from '@/lib/complaints/complaints';
import {
  createWorkOrder,
  type CreateWorkOrderInput,
  type WorkOrderCategory,
  type WorkOrderPriority,
} from '@/lib/work-orders/work-orders';
import { findUnitById } from '@/lib/units/units';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Maps complaint category to work order category.
 */
function mapComplaintCategoryToWorkOrderCategory(
  complaintCategory: Complaint['category'],
  maintenanceCategory?: Complaint['maintenanceCategory'],
): WorkOrderCategory {
  // If it's a maintenance request with a specific category, use that
  if (maintenanceCategory) {
    switch (maintenanceCategory) {
      case 'plumbing':
        return 'plumbing';
      case 'electrical':
        return 'electrical';
      case 'hvac':
        return 'hvac';
      case 'appliance':
      case 'structural':
      case 'other':
        return 'other';
    }
  }

  // Otherwise, map complaint category
  switch (complaintCategory) {
    case 'maintenance':
      return 'other'; // Default for general maintenance
    case 'security':
      return 'security';
    case 'cleanliness':
      return 'cleaning';
    default:
      return 'other';
  }
}

/**
 * Maps complaint priority/urgency to work order priority.
 */
function mapPriorityToWorkOrderPriority(
  complaintPriority: Complaint['priority'],
  urgency?: Complaint['urgency'],
): CreateWorkOrderInput['priority'] {
  // If urgency is provided (for maintenance requests), use that
  if (urgency) {
    switch (urgency) {
      case 'emergency':
        return 'urgent';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
    }
  }

  // Otherwise, use complaint priority
  switch (complaintPriority) {
    case 'urgent':
      return 'urgent';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
  }
}

/**
 * POST /api/complaints/[id]/convert-to-work-order
 * Convert a complaint to a work order.
 * Requires work_orders.create permission.
 */
export async function POST(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create work orders
    requirePermission(context, 'maintenance', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get complaint
    const complaint = await findComplaintById(id, organizationId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, complaint.organizationId);

    // Check if complaint already has a linked work order
    if (complaint.linkedWorkOrderId) {
      return NextResponse.json(
        { error: 'Complaint already has a linked work order' },
        { status: 400 },
      );
    }

    // Validate complaint is in a valid state for conversion
    if (complaint.status === 'closed' || complaint.status === 'resolved') {
      return NextResponse.json(
        { error: 'Cannot convert closed or resolved complaint to work order' },
        { status: 400 },
      );
    }

    // Get unit to find building
    let buildingId: string;
    if (complaint.unitId) {
      const unit = await findUnitById(complaint.unitId, organizationId);
      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }
      buildingId = unit.buildingId;
    } else {
      return NextResponse.json(
        { error: 'Complaint must be associated with a unit to create work order' },
        { status: 400 },
      );
    }

    // Get request body for optional overrides
    const body = (await request.json()) as Partial<{
      buildingId: string;
      priority: CreateWorkOrderInput['priority'];
      category: WorkOrderCategory;
      assignedTo: string | null;
      scheduledDate: string;
      scheduledTimeWindow: { start: string; end: string };
    }>;

    // Create work order from complaint
    const workOrderInput: CreateWorkOrderInput = {
      organizationId,
      buildingId: body.buildingId || buildingId,
      complaintId: complaint._id,
      unitId: complaint.unitId ?? null,
      title: complaint.title,
      description: complaint.description,
      category:
        body.category ||
        mapComplaintCategoryToWorkOrderCategory(complaint.category, complaint.maintenanceCategory),
      ...(body.priority || mapPriorityToWorkOrderPriority(complaint.priority, complaint.urgency)
        ? {
            priority: (body.priority ||
              mapPriorityToWorkOrderPriority(complaint.priority, complaint.urgency)) as
              | WorkOrderPriority
              | undefined,
          }
        : {}),
      status: body.assignedTo ? 'assigned' : 'open',
      assignedTo: body.assignedTo ?? null,
      createdBy: context.userId || 'system',
    };

    // Add scheduling if provided
    if (body.scheduledDate) {
      workOrderInput.scheduledDate = body.scheduledDate;
    }
    if (body.scheduledTimeWindow) {
      workOrderInput.scheduledTimeWindow = {
        start: body.scheduledTimeWindow.start,
        end: body.scheduledTimeWindow.end,
      };
    }

    // Use preferred time window from complaint if available and not overridden
    if (!body.scheduledTimeWindow && complaint.preferredTimeWindow) {
      workOrderInput.scheduledTimeWindow = {
        start: complaint.preferredTimeWindow.start,
        end: complaint.preferredTimeWindow.end,
      };
    }

    try {
      const workOrder = await createWorkOrder(workOrderInput);

      // Update complaint with linked work order ID and status
      await updateComplaint(id, {
        linkedWorkOrderId: workOrder._id,
        status: body.assignedTo ? 'in_progress' : 'assigned',
      });

      return NextResponse.json(
        {
          message: 'Work order created successfully from complaint',
          workOrder: {
            _id: workOrder._id,
            organizationId: workOrder.organizationId,
            buildingId: workOrder.buildingId,
            complaintId: workOrder.complaintId,
            unitId: workOrder.unitId,
            assetId: workOrder.assetId,
            title: workOrder.title,
            description: workOrder.description,
            category: workOrder.category,
            priority: workOrder.priority,
            status: workOrder.status,
            assignedTo: workOrder.assignedTo,
            estimatedCost: workOrder.estimatedCost,
            scheduledDate: workOrder.scheduledDate,
            scheduledTimeWindow: workOrder.scheduledTimeWindow,
            createdAt: workOrder.createdAt,
            updatedAt: workOrder.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('does not belong')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Convert complaint to work order error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while converting complaint to work order' },
      { status: 500 },
    );
  }
}
