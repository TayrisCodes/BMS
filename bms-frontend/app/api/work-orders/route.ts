import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createWorkOrder,
  listWorkOrders,
  findWorkOrdersByBuilding,
  findWorkOrdersByTechnician,
  type CreateWorkOrderInput,
  type WorkOrderStatus,
  type WorkOrderPriority,
  type WorkOrderCategory,
} from '@/lib/work-orders/work-orders';

/**
 * GET /api/work-orders
 * List work orders with optional filters.
 * Requires workOrders.read or maintenance.read permission.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read work orders
    try {
      requirePermission(context, 'maintenance', 'read');
    } catch {
      // Fallback to workOrders permission if maintenance doesn't exist
      requirePermission(context, 'complaints', 'read');
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const assignedTo = searchParams.get('assignedTo');
    const complaintId = searchParams.get('complaintId');
    const status = searchParams.get('status') as WorkOrderStatus | null;
    const priority = searchParams.get('priority') as WorkOrderPriority | null;
    const category = searchParams.get('category') as WorkOrderCategory | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    let workOrders;

    // If assignedTo=me, return work orders for current user (technician)
    if (assignedTo === 'me') {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      if (priority) {
        filters.priority = priority;
      }
      if (category) {
        filters.category = category;
      }
      if (buildingId) {
        filters.buildingId = buildingId;
      }
      if (complaintId) {
        filters.complaintId = complaintId;
      }

      workOrders = await findWorkOrdersByTechnician(
        context.userId,
        context.organizationId || undefined,
        filters,
      );
    }
    // If buildingId is specified, use findWorkOrdersByBuilding
    else if (buildingId) {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      if (priority) {
        filters.priority = priority;
      }
      if (category) {
        filters.category = category;
      }
      if (assignedTo) {
        filters.assignedTo = assignedTo;
      }
      if (complaintId) {
        filters.complaintId = complaintId;
      }

      workOrders = await findWorkOrdersByBuilding(
        buildingId,
        context.organizationId || undefined,
        filters,
      );
    }
    // Otherwise, list all work orders with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (status) {
        baseQuery.status = status;
      }
      if (priority) {
        baseQuery.priority = priority;
      }
      if (category) {
        baseQuery.category = category;
      }
      if (assignedTo) {
        baseQuery.assignedTo = assignedTo;
      }
      if (complaintId) {
        baseQuery.complaintId = complaintId;
      }

      workOrders = await listWorkOrders(baseQuery);
    }

    // Apply limit
    workOrders = workOrders.slice(0, limit);

    return NextResponse.json({
      workOrders: workOrders.map((wo) => ({
        _id: wo._id,
        organizationId: wo.organizationId,
        buildingId: wo.buildingId,
        complaintId: wo.complaintId,
        unitId: wo.unitId,
        assetId: wo.assetId,
        title: wo.title,
        description: wo.description,
        category: wo.category,
        priority: wo.priority,
        status: wo.status,
        assignedTo: wo.assignedTo,
        estimatedCost: wo.estimatedCost,
        actualCost: wo.actualCost,
        completedAt: wo.completedAt,
        notes: wo.notes,
        photos: wo.photos,
        createdBy: wo.createdBy,
        createdAt: wo.createdAt,
        updatedAt: wo.updatedAt,
      })),
      count: workOrders.length,
    });
  } catch (error) {
    console.error('Get work orders error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching work orders' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/work-orders
 * Create a new work order.
 * Requires maintenance.create or FACILITY_MANAGER, BUILDING_MANAGER, or ORG_ADMIN role.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create work orders
    // FACILITY_MANAGER, BUILDING_MANAGER, ORG_ADMIN can create
    try {
      requirePermission(context, 'maintenance', 'create');
    } catch {
      // Check if user has appropriate role
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateWorkOrderInput>;

    // Validate required fields
    if (!body.buildingId || !body.title || !body.description || !body.category) {
      return NextResponse.json(
        {
          error: 'buildingId, title, description, and category are required',
        },
        { status: 400 },
      );
    }

    // Create work order
    const input: CreateWorkOrderInput = {
      organizationId,
      buildingId: body.buildingId,
      complaintId: body.complaintId ?? null,
      unitId: body.unitId ?? null,
      assetId: body.assetId ?? null,
      title: body.title,
      description: body.description,
      category: body.category,
      priority: body.priority ?? 'medium',
      status: body.status ?? 'open',
      assignedTo: body.assignedTo ?? null,
      estimatedCost: body.estimatedCost ?? null,
      createdBy: context.userId,
    };

    try {
      const workOrder = await createWorkOrder(input);

      // Trigger notification if work order is assigned
      if (workOrder.assignedTo) {
        try {
          const { notifyWorkOrderAssigned } = await import('@/modules/notifications/events');
          await notifyWorkOrderAssigned(
            workOrder._id.toString(),
            workOrder.organizationId,
            workOrder.assignedTo,
            workOrder.priority,
            undefined, // dueDate - can be added later if needed
          );
        } catch (notifError) {
          console.error('[WorkOrders] Failed to send assignment notification:', notifError);
          // Don't fail the request if notification fails
        }
      }

      return NextResponse.json(
        {
          message: 'Work order created successfully',
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
            actualCost: workOrder.actualCost,
            completedAt: workOrder.completedAt,
            notes: workOrder.notes,
            photos: workOrder.photos,
            createdBy: workOrder.createdBy,
            createdAt: workOrder.createdAt,
            updatedAt: workOrder.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Unit not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('are required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create work order error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating work order' },
      { status: 500 },
    );
  }
}
