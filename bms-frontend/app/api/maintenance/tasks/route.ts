import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createMaintenanceTask,
  listMaintenanceTasks,
  findMaintenanceTasksByStatus,
  findDueMaintenanceTasks,
  type CreateMaintenanceTaskInput,
  type MaintenanceTaskStatus,
} from '@/lib/maintenance/maintenance-tasks';

/**
 * GET /api/maintenance/tasks
 * List maintenance tasks with optional filters.
 * Requires assets.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read assets
    requirePermission(context, 'assets', 'read');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as MaintenanceTaskStatus | null;
    const assetId = searchParams.get('assetId');
    const buildingId = searchParams.get('buildingId');
    const dueOnly = searchParams.get('dueOnly') === 'true';

    let tasks;

    if (dueOnly) {
      tasks = await findDueMaintenanceTasks(organizationId, true);
    } else if (status) {
      const filters: Record<string, unknown> = {};
      if (assetId) {
        filters.assetId = assetId;
      }
      if (buildingId) {
        filters.buildingId = buildingId;
      }
      tasks = await findMaintenanceTasksByStatus(status, organizationId, filters);
    } else {
      const query: Record<string, unknown> = { organizationId };
      if (assetId) {
        query.assetId = assetId;
      }
      if (buildingId) {
        query.buildingId = buildingId;
      }
      tasks = await listMaintenanceTasks(query);
    }

    return NextResponse.json({
      tasks: tasks.map((task) => ({
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
      })),
      count: tasks.length,
    });
  } catch (error) {
    console.error('Get maintenance tasks error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching maintenance tasks' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/maintenance/tasks
 * Create a new maintenance task.
 * Requires assets.update permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update assets
    requirePermission(context, 'assets', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateMaintenanceTaskInput> & {
      nextDueDate?: string;
      lastPerformed?: string;
    };

    // Validate required fields
    if (
      !body.assetId ||
      !body.buildingId ||
      !body.taskName ||
      !body.description ||
      !body.scheduleType ||
      !body.nextDueDate
    ) {
      return NextResponse.json(
        {
          error:
            'assetId, buildingId, taskName, description, scheduleType, and nextDueDate are required',
        },
        { status: 400 },
      );
    }

    // Validate schedule type
    if (body.scheduleType === 'time-based' && !body.frequency) {
      return NextResponse.json(
        { error: 'frequency is required for time-based schedules' },
        { status: 400 },
      );
    }
    if (body.scheduleType === 'usage-based' && !body.usageThreshold) {
      return NextResponse.json(
        { error: 'usageThreshold is required for usage-based schedules' },
        { status: 400 },
      );
    }

    const input: CreateMaintenanceTaskInput = {
      organizationId,
      assetId: body.assetId,
      buildingId: body.buildingId,
      taskName: body.taskName,
      description: body.description,
      scheduleType: body.scheduleType,
      frequency: body.frequency ?? null,
      usageThreshold: body.usageThreshold ?? null,
      estimatedDuration: body.estimatedDuration ?? null,
      estimatedCost: body.estimatedCost ?? null,
      assignedTo: body.assignedTo ?? null,
      lastPerformed: body.lastPerformed || null,
      nextDueDate: body.nextDueDate,
      autoGenerateWorkOrder: body.autoGenerateWorkOrder ?? false,
    };

    try {
      const task = await createMaintenanceTask(input);

      return NextResponse.json(
        {
          message: 'Maintenance task created successfully',
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
    console.error('Create maintenance task error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating maintenance task' },
      { status: 500 },
    );
  }
}
