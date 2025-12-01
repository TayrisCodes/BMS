import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findWorkOrderById,
  updateWorkOrder,
  updateWorkOrderStatus,
  completeWorkOrder,
  type WorkOrderStatus,
} from '@/lib/work-orders/work-orders';

/**
 * GET /api/work-orders/[id]
 * Get a single work order.
 * Requires workOrders.read or maintenance.read permission.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read work orders
    try {
      requirePermission(context, 'maintenance', 'read');
    } catch {
      requirePermission(context, 'complaints', 'read');
    }

    const workOrderId = params.id;

    const workOrder = await findWorkOrderById(workOrderId, context.organizationId || undefined);

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, workOrder.organizationId);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Get work order error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching work order' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/work-orders/[id]
 * Update a work order (status, assignment, notes, costs).
 * Requires maintenance.update permission or appropriate role.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update work orders
    try {
      requirePermission(context, 'maintenance', 'update');
    } catch {
      // Check if user has appropriate role
      if (
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN') &&
        !context.roles.includes('TECHNICIAN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const workOrderId = params.id;
    const body = (await request.json()) as Partial<{
      status: WorkOrderStatus;
      assignedTo: string | null;
      notes: string | null;
      estimatedCost: number | null;
      actualCost: number | null;
      title: string;
      description: string;
      priority: string;
      category: string;
      photos: string[] | null;
    }>;

    // Get existing work order to validate access
    const existingWorkOrder = await findWorkOrderById(
      workOrderId,
      context.organizationId || undefined,
    );

    if (!existingWorkOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingWorkOrder.organizationId);

    // If technician is updating, verify they are assigned to the work order
    if (context.roles.includes('TECHNICIAN')) {
      if (existingWorkOrder.assignedTo !== context.userId) {
        return NextResponse.json(
          { error: 'Access denied: work order not assigned to you' },
          { status: 403 },
        );
      }
    }

    // If status is being updated to completed, use completeWorkOrder
    if (body.status === 'completed') {
      const completed = await completeWorkOrder(
        workOrderId,
        body.actualCost,
        body.notes,
        body.photos,
      );

      if (!completed) {
        return NextResponse.json({ error: 'Failed to complete work order' }, { status: 500 });
      }

      // Trigger notification for work order completion
      try {
        const { notifyWorkOrderCompleted } = await import('@/modules/notifications/events');
        await notifyWorkOrderCompleted(workOrderId, completed.organizationId);
      } catch (notifError) {
        console.error('[WorkOrders] Failed to send completion notification:', notifError);
        // Don't fail the request if notification fails
      }

      return NextResponse.json({
        message: 'Work order completed successfully',
        workOrder: {
          _id: completed._id,
          organizationId: completed.organizationId,
          buildingId: completed.buildingId,
          complaintId: completed.complaintId,
          unitId: completed.unitId,
          assetId: completed.assetId,
          title: completed.title,
          description: completed.description,
          category: completed.category,
          priority: completed.priority,
          status: completed.status,
          assignedTo: completed.assignedTo,
          estimatedCost: completed.estimatedCost,
          actualCost: completed.actualCost,
          completedAt: completed.completedAt,
          notes: completed.notes,
          photos: completed.photos,
          createdBy: completed.createdBy,
          createdAt: completed.createdAt,
          updatedAt: completed.updatedAt,
        },
      });
    }

    // Otherwise, use updateWorkOrder
    const updates: Partial<{
      status: WorkOrderStatus;
      assignedTo: string | null;
      notes: string | null;
      estimatedCost: number | null;
      actualCost: number | null;
      title: string;
      description: string;
      priority: string;
      category: string;
      photos: string[] | null;
    }> = {};

    if (body.status !== undefined) {
      updates.status = body.status;
    }
    if (body.assignedTo !== undefined) {
      updates.assignedTo = body.assignedTo;

      // Trigger notification if work order is being assigned
      if (body.assignedTo && body.assignedTo !== existingWorkOrder.assignedTo) {
        try {
          const { notifyWorkOrderAssigned } = await import('@/modules/notifications/events');
          await notifyWorkOrderAssigned(
            workOrderId,
            existingWorkOrder.organizationId,
            body.assignedTo,
            existingWorkOrder.priority,
            undefined, // dueDate - can be added later if needed
          );
        } catch (notifError) {
          console.error('[WorkOrders] Failed to send assignment notification:', notifError);
          // Don't fail the request if notification fails
        }
      }
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }
    if (body.estimatedCost !== undefined) {
      updates.estimatedCost = body.estimatedCost;
    }
    if (body.actualCost !== undefined) {
      updates.actualCost = body.actualCost;
    }
    if (body.title !== undefined) {
      updates.title = body.title;
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }
    if (body.priority !== undefined) {
      updates.priority = body.priority as any;
    }
    if (body.category !== undefined) {
      updates.category = body.category as any;
    }
    if (body.photos !== undefined) {
      updates.photos = body.photos;
    }

    const updated = await updateWorkOrder(workOrderId, updates as any);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update work order' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Work order updated successfully',
      workOrder: {
        _id: updated._id,
        organizationId: updated.organizationId,
        buildingId: updated.buildingId,
        complaintId: updated.complaintId,
        unitId: updated.unitId,
        assetId: updated.assetId,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        priority: updated.priority,
        status: updated.status,
        assignedTo: updated.assignedTo,
        estimatedCost: updated.estimatedCost,
        actualCost: updated.actualCost,
        completedAt: updated.completedAt,
        notes: updated.notes,
        photos: updated.photos,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update work order error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Building not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Unit not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating work order' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/work-orders/[id]
 * Cancel a work order (set status to cancelled).
 * Requires maintenance.update permission or appropriate role.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update work orders
    try {
      requirePermission(context, 'maintenance', 'update');
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

    const workOrderId = params.id;

    // Get existing work order to validate access
    const existingWorkOrder = await findWorkOrderById(
      workOrderId,
      context.organizationId || undefined,
    );

    if (!existingWorkOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingWorkOrder.organizationId);

    // Cancel the work order (set status to cancelled)
    const cancelled = await updateWorkOrderStatus(workOrderId, 'cancelled');

    if (!cancelled) {
      return NextResponse.json({ error: 'Failed to cancel work order' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Work order cancelled successfully',
      workOrder: {
        _id: cancelled._id,
        organizationId: cancelled.organizationId,
        buildingId: cancelled.buildingId,
        complaintId: cancelled.complaintId,
        unitId: cancelled.unitId,
        assetId: cancelled.assetId,
        title: cancelled.title,
        description: cancelled.description,
        category: cancelled.category,
        priority: cancelled.priority,
        status: cancelled.status,
        assignedTo: cancelled.assignedTo,
        estimatedCost: cancelled.estimatedCost,
        actualCost: cancelled.actualCost,
        completedAt: cancelled.completedAt,
        notes: cancelled.notes,
        photos: cancelled.photos,
        createdBy: cancelled.createdBy,
        createdAt: cancelled.createdAt,
        updatedAt: cancelled.updatedAt,
      },
    });
  } catch (error) {
    console.error('Cancel work order error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while cancelling work order' },
      { status: 500 },
    );
  }
}
