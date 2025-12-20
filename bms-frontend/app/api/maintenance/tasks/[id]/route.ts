import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findMaintenanceTaskById,
  updateMaintenanceTask,
  completeMaintenanceTask,
  type MaintenanceTask,
} from '@/lib/maintenance/maintenance-tasks';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/maintenance/tasks/[id]
 * Get a single maintenance task by ID.
 * Requires assets.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read assets
    requirePermission(context, 'assets', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const task = await findMaintenanceTaskById(id, organizationId);

    if (!task) {
      return NextResponse.json({ error: 'Maintenance task not found' }, { status: 404 });
    }

    return NextResponse.json({
      task: {
        _id: task._id,
        organizationId: task.organizationId,
        assetId: task.assetId,
        buildingId: task.buildingId,
        taskName: task.taskName,
        description: task.description,
        scheduleType: task.scheduleType,
        frequency: task.frequency,
        usageThreshold: task.usageThreshold,
        estimatedDuration: task.estimatedDuration,
        estimatedCost: task.estimatedCost,
        assignedTo: task.assignedTo,
        lastPerformed: task.lastPerformed,
        nextDueDate: task.nextDueDate,
        status: task.status,
        autoGenerateWorkOrder: task.autoGenerateWorkOrder,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get maintenance task error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching maintenance task' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/maintenance/tasks/[id]
 * Update a maintenance task.
 * Requires assets.update permission.
 */
export async function PUT(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update assets
    requirePermission(context, 'assets', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<MaintenanceTask> & {
      nextDueDate?: string;
      lastPerformed?: string;
    };

    const updates: Partial<MaintenanceTask> = {
      ...body,
    };

    // Convert date strings
    if (body.nextDueDate) {
      updates.nextDueDate =
        typeof body.nextDueDate === 'string' ? new Date(body.nextDueDate) : body.nextDueDate;
    }
    if (body.lastPerformed !== undefined) {
      updates.lastPerformed =
        body.lastPerformed && typeof body.lastPerformed === 'string'
          ? new Date(body.lastPerformed)
          : body.lastPerformed;
    }

    try {
      const updatedTask = await updateMaintenanceTask(id, updates, organizationId);

      if (!updatedTask) {
        return NextResponse.json({ error: 'Maintenance task not found' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Maintenance task updated successfully',
        task: {
          _id: updatedTask._id,
          organizationId: updatedTask.organizationId,
          assetId: updatedTask.assetId,
          buildingId: updatedTask.buildingId,
          taskName: updatedTask.taskName,
          description: updatedTask.description,
          scheduleType: updatedTask.scheduleType,
          frequency: updatedTask.frequency,
          usageThreshold: updatedTask.usageThreshold,
          estimatedDuration: updatedTask.estimatedDuration,
          estimatedCost: updatedTask.estimatedCost,
          assignedTo: updatedTask.assignedTo,
          lastPerformed: updatedTask.lastPerformed,
          nextDueDate: updatedTask.nextDueDate,
          status: updatedTask.status,
          autoGenerateWorkOrder: updatedTask.autoGenerateWorkOrder,
          createdAt: updatedTask.createdAt,
          updatedAt: updatedTask.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update maintenance task error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating maintenance task' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/maintenance/tasks/[id]
 * Cancel a maintenance task (soft delete by setting status to cancelled).
 * Requires assets.update permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update assets
    requirePermission(context, 'assets', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    try {
      const updatedTask = await updateMaintenanceTask(id, { status: 'cancelled' }, organizationId);

      if (!updatedTask) {
        return NextResponse.json({ error: 'Maintenance task not found' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Maintenance task cancelled successfully',
        task: {
          _id: updatedTask._id,
          status: updatedTask.status,
        },
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Cancel maintenance task error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while cancelling maintenance task' },
      { status: 500 },
    );
  }
}

