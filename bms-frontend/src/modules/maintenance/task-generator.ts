import {
  findMaintenanceTasksByAsset,
  findDueMaintenanceTasks,
  updateMaintenanceTask,
  completeMaintenanceTask,
  type MaintenanceTask,
} from '@/lib/maintenance/maintenance-tasks';
import { findAssetsByOrganization, type Asset } from '@/lib/assets/assets';
import { createWorkOrder, type CreateWorkOrderInput } from '@/lib/work-orders/work-orders';

/**
 * Automatic maintenance task generation and work order creation module.
 */

/**
 * Generates maintenance tasks for assets based on their maintenance schedules.
 * This function should be called periodically (e.g., daily via cron) to ensure
 * all assets with maintenance schedules have corresponding maintenance tasks.
 */
export async function generateMaintenanceTasks(
  organizationId: string,
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Get all active assets for the organization
    const assets = await findAssetsByOrganization(organizationId, {
      status: 'active',
    });

    for (const asset of assets) {
      try {
        // Check if asset has a maintenance schedule
        if (!asset.maintenanceSchedule || !asset.maintenanceSchedule.frequency) {
          continue;
        }

        // Find existing maintenance tasks for this asset
        const existingTasks = await findMaintenanceTasksByAsset(asset._id, organizationId, {
          status: { $ne: 'cancelled' },
        });

        // If no tasks exist, create one based on the asset's schedule
        if (existingTasks.length === 0) {
          // Parse frequency from asset schedule (e.g., "monthly", "quarterly", "annually")
          const frequency = asset.maintenanceSchedule.frequency.toLowerCase();
          let interval = 1;
          let unit: 'days' | 'weeks' | 'months' = 'months';

          if (frequency.includes('month')) {
            if (frequency.includes('quarter')) {
              interval = 3;
            } else if (frequency.includes('annual') || frequency.includes('year')) {
              interval = 12;
            } else {
              interval = 1;
            }
            unit = 'months';
          } else if (frequency.includes('week')) {
            interval = 1;
            unit = 'weeks';
          } else if (frequency.includes('day')) {
            interval = 1;
            unit = 'days';
          }

          // Calculate next due date
          const now = new Date();
          let nextDueDate = new Date(now);

          if (asset.maintenanceSchedule.nextMaintenanceDate) {
            nextDueDate = new Date(asset.maintenanceSchedule.nextMaintenanceDate);
          } else if (asset.maintenanceSchedule.lastMaintenanceDate) {
            const lastDate = new Date(asset.maintenanceSchedule.lastMaintenanceDate);
            nextDueDate = new Date(lastDate);

            switch (unit) {
              case 'days':
                nextDueDate.setDate(nextDueDate.getDate() + interval);
                break;
              case 'weeks':
                nextDueDate.setDate(nextDueDate.getDate() + interval * 7);
                break;
              case 'months':
                nextDueDate.setMonth(nextDueDate.getMonth() + interval);
                break;
            }
          } else {
            // No previous maintenance, set due date based on interval from now
            switch (unit) {
              case 'days':
                nextDueDate.setDate(nextDueDate.getDate() + interval);
                break;
              case 'weeks':
                nextDueDate.setDate(nextDueDate.getDate() + interval * 7);
                break;
              case 'months':
                nextDueDate.setMonth(nextDueDate.getMonth() + interval);
                break;
            }
          }

          // Create maintenance task
          const { createMaintenanceTask } = await import('@/lib/maintenance/maintenance-tasks');
          await createMaintenanceTask({
            organizationId,
            assetId: asset._id,
            buildingId: asset.buildingId,
            taskName: `Maintenance for ${asset.name}`,
            description: `Scheduled maintenance for ${asset.name} (${asset.assetType})`,
            scheduleType: 'time-based',
            frequency: {
              interval,
              unit,
            },
            nextDueDate,
            autoGenerateWorkOrder: true,
          });

          created++;
        } else {
          // Update existing tasks if asset schedule has changed
          // For now, we'll just mark this as updated
          updated++;
        }
      } catch (error) {
        console.error(`Error processing asset ${asset._id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error generating maintenance tasks:', error);
    throw error;
  }

  return { created, updated, errors };
}

/**
 * Creates a work order from a maintenance task.
 * This is called when a maintenance task is due and autoGenerateWorkOrder is enabled.
 */
export async function createWorkOrderFromTask(
  taskId: string,
  organizationId: string,
  createdBy?: string,
): Promise<string> {
  const { findMaintenanceTaskById } = await import('@/lib/maintenance/maintenance-tasks');
  const task = await findMaintenanceTaskById(taskId, organizationId);

  if (!task) {
    throw new Error('Maintenance task not found');
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error('Cannot create work order from completed or cancelled task');
  }

  // Get asset details
  const { findAssetById } = await import('@/lib/assets/assets');
  const asset = await findAssetById(task.assetId, organizationId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  // Map task to work order
  const workOrderInput: CreateWorkOrderInput = {
    organizationId,
    buildingId: task.buildingId,
    unitId: asset.unitId ?? null,
    assetId: task.assetId,
    title: task.taskName,
    description: task.description,
    category: mapAssetTypeToWorkOrderCategory(asset.assetType),
    priority: determinePriorityFromTask(task),
    status: task.assignedTo ? 'assigned' : 'open',
    assignedTo: task.assignedTo ?? null,
    estimatedCost: task.estimatedCost ?? null,
    createdBy: createdBy || 'system',
  };

  const workOrder = await createWorkOrder(workOrderInput);

  // Update task to mark that work order was created
  // Note: We don't mark task as completed here - that happens when work order is completed
  await updateMaintenanceTask(
    taskId,
    {
      // We could add a field to track linked work order, but for now we'll just update status
      status: task.assignedTo ? 'due' : 'due',
    },
    organizationId,
  );

  return workOrder._id;
}

/**
 * Maps asset type to work order category.
 */
function mapAssetTypeToWorkOrderCategory(
  assetType: Asset['assetType'],
): CreateWorkOrderInput['category'] {
  switch (assetType) {
    case 'equipment':
    case 'appliance':
      return 'hvac';
    case 'infrastructure':
      return 'plumbing';
    case 'vehicle':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Determines work order priority from maintenance task.
 */
function determinePriorityFromTask(task: MaintenanceTask): CreateWorkOrderInput['priority'] {
  if (task.status === 'overdue') {
    return 'high';
  }
  if (task.status === 'due') {
    return 'medium';
  }
  return 'low';
}

/**
 * Processes due maintenance tasks and creates work orders if auto-generation is enabled.
 * This function should be called periodically (e.g., daily via cron).
 */
export async function processDueMaintenanceTasks(
  organizationId: string,
): Promise<{ processed: number; workOrdersCreated: number; errors: number }> {
  let processed = 0;
  let workOrdersCreated = 0;
  let errors = 0;

  try {
    // Find all due and overdue tasks
    const dueTasks = await findDueMaintenanceTasks(organizationId, true);

    for (const task of dueTasks) {
      try {
        // Only create work orders if auto-generation is enabled
        if (task.autoGenerateWorkOrder && task.status !== 'completed') {
          await createWorkOrderFromTask(task._id, organizationId, 'system');
          workOrdersCreated++;
        }
        processed++;
      } catch (error) {
        console.error(`Error processing task ${task._id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Error processing due maintenance tasks:', error);
    throw error;
  }

  return { processed, workOrdersCreated, errors };
}

