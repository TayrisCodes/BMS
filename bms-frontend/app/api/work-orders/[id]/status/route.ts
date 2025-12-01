import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findWorkOrderById,
  updateWorkOrderStatus,
  type WorkOrderStatus,
} from '@/lib/work-orders/work-orders';

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  open: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [], // Cannot transition from completed
  cancelled: [], // Cannot transition from cancelled
};

/**
 * PATCH /api/work-orders/[id]/status
 * Update work order status with validation.
 * Validates status transitions and verifies technician assignment if applicable.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const workOrderId = params.id;
    const body = (await request.json()) as { status: WorkOrderStatus };

    if (!body.status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Get existing work order
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

    // Validate status transition
    const currentStatus = existingWorkOrder.status;
    const newStatus = body.status;

    // If status is the same, allow it (idempotent)
    if (currentStatus === newStatus) {
      return NextResponse.json({
        message: 'Work order status is already set to this value',
        workOrder: {
          _id: existingWorkOrder._id,
          organizationId: existingWorkOrder.organizationId,
          buildingId: existingWorkOrder.buildingId,
          complaintId: existingWorkOrder.complaintId,
          unitId: existingWorkOrder.unitId,
          assetId: existingWorkOrder.assetId,
          title: existingWorkOrder.title,
          description: existingWorkOrder.description,
          category: existingWorkOrder.category,
          priority: existingWorkOrder.priority,
          status: existingWorkOrder.status,
          assignedTo: existingWorkOrder.assignedTo,
          estimatedCost: existingWorkOrder.estimatedCost,
          actualCost: existingWorkOrder.actualCost,
          completedAt: existingWorkOrder.completedAt,
          notes: existingWorkOrder.notes,
          photos: existingWorkOrder.photos,
          createdBy: existingWorkOrder.createdBy,
          createdAt: existingWorkOrder.createdAt,
          updatedAt: existingWorkOrder.updatedAt,
        },
      });
    }

    // Check if transition is valid
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: cannot change from ${currentStatus} to ${newStatus}. Allowed transitions from ${currentStatus}: ${allowedTransitions.join(', ') || 'none'}`,
        },
        { status: 400 },
      );
    }

    // Update status
    const updated = await updateWorkOrderStatus(workOrderId, newStatus);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update work order status' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Work order status updated successfully',
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
    console.error('Update work order status error', error);
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
      { error: 'Unexpected error while updating work order status' },
      { status: 500 },
    );
  }
}
