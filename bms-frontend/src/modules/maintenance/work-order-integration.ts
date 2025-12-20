import { findWorkOrderById, updateWorkOrder, type WorkOrder } from '@/lib/work-orders/work-orders';
import {
  createMaintenanceHistory,
  type CreateMaintenanceHistoryInput,
} from '@/lib/assets/maintenance-history';
import { updateAsset, findAssetById } from '@/lib/assets/assets';
import {
  updateMaintenanceTask,
  findMaintenanceTaskById,
} from '@/lib/maintenance/maintenance-tasks';

/**
 * Work order integration module.
 * Handles integration between work orders, maintenance history, assets, and maintenance tasks.
 */

/**
 * When a work order is completed, this function:
 * 1. Creates a maintenance history entry for the linked asset (if any)
 * 2. Updates the asset's last maintenance date
 * 3. Updates linked maintenance task status (if any)
 * 4. Calculates next maintenance due date if preventive
 */
export async function handleWorkOrderCompletion(
  workOrderId: string,
  organizationId: string,
  performedBy?: string,
): Promise<void> {
  const workOrder = await findWorkOrderById(workOrderId, organizationId);
  if (!workOrder) {
    throw new Error('Work order not found');
  }

  if (workOrder.status !== 'completed') {
    throw new Error('Work order is not completed');
  }

  // If work order is linked to an asset, create maintenance history
  if (workOrder.assetId) {
    // Determine maintenance type based on work order category and description
    let maintenanceType: 'preventive' | 'corrective' | 'emergency' = 'corrective';

    // Check if it's linked to a maintenance task (preventive)
    // For now, we'll check the description or category
    if (
      workOrder.description.toLowerCase().includes('preventive') ||
      workOrder.description.toLowerCase().includes('scheduled')
    ) {
      maintenanceType = 'preventive';
    } else if (
      workOrder.priority === 'urgent' ||
      workOrder.description.toLowerCase().includes('emergency')
    ) {
      maintenanceType = 'emergency';
    }

    // Calculate downtime if we have start and completion times
    let downtimeHours: number | null = null;
    if (workOrder.startedAt && workOrder.completedAt) {
      const downtimeMs = workOrder.completedAt.getTime() - workOrder.startedAt.getTime();
      downtimeHours = downtimeMs / (1000 * 60 * 60);
    }

    // Create maintenance history entry
    const historyInput: CreateMaintenanceHistoryInput = {
      organizationId,
      assetId: workOrder.assetId,
      workOrderId: workOrder._id,
      maintenanceType,
      performedBy: performedBy || workOrder.assignedTo || null,
      performedDate: workOrder.completedAt || new Date(),
      description: workOrder.description,
      cost: workOrder.actualCost ?? null,
      downtimeHours,
      notes: workOrder.notes ?? null,
      // For preventive maintenance, calculate next due date
      nextMaintenanceDue:
        maintenanceType === 'preventive' ? calculateNextMaintenanceDue(workOrder) : null,
    };

    await createMaintenanceHistory(historyInput);

    // Update asset's last maintenance date
    const asset = await findAssetById(workOrder.assetId, organizationId);
    if (asset) {
      await updateAsset(workOrder.assetId, {
        maintenanceSchedule: {
          ...asset.maintenanceSchedule,
          lastMaintenanceDate: workOrder.completedAt || new Date(),
          nextMaintenanceDate:
            maintenanceType === 'preventive'
              ? calculateNextMaintenanceDue(workOrder)
              : asset.maintenanceSchedule?.nextMaintenanceDate || null,
        },
      });
    }
  }

  // If work order is linked to a maintenance task, update task status
  // Note: We need to find the task by assetId and check if it matches
  // For now, we'll check if there's a maintenance task for this asset that's due
  if (workOrder.assetId) {
    const { findMaintenanceTasksByAsset } = await import('@/lib/maintenance/maintenance-tasks');
    const tasks = await findMaintenanceTasksByAsset(workOrder.assetId, organizationId, {
      status: { $in: ['due', 'overdue'] },
    });

    // Mark the first matching task as completed
    if (tasks.length > 0) {
      const task = tasks[0];
      await updateMaintenanceTask(
        task._id,
        {
          status: 'completed',
          lastPerformed: workOrder.completedAt || new Date(),
        },
        organizationId,
      );
    }
  }
}

/**
 * Calculates the next maintenance due date based on work order completion.
 * This is a simple implementation - in production, you'd use the asset's maintenance schedule.
 */
function calculateNextMaintenanceDue(workOrder: WorkOrder): Date | null {
  if (!workOrder.completedAt) {
    return null;
  }

  // Default: next maintenance in 3 months
  const nextDue = new Date(workOrder.completedAt);
  nextDue.setMonth(nextDue.getMonth() + 3);
  return nextDue;
}

/**
 * Updates work order with startedAt timestamp when technician starts work.
 */
export async function startWorkOrder(
  workOrderId: string,
  organizationId: string,
): Promise<WorkOrder | null> {
  const workOrder = await findWorkOrderById(workOrderId, organizationId);
  if (!workOrder) {
    return null;
  }

  // Only allow starting if status is 'assigned' or 'open'
  if (workOrder.status !== 'assigned' && workOrder.status !== 'open') {
    throw new Error('Work order cannot be started in current status');
  }

  return updateWorkOrder(workOrderId, {
    status: 'in_progress',
    startedAt: new Date(),
  });
}

/**
 * Completes a work order and triggers maintenance history creation.
 */
export async function completeWorkOrderWithIntegration(
  workOrderId: string,
  organizationId: string,
  actualCost?: number | null,
  notes?: string | null,
  photos?: string[] | null,
  performedBy?: string,
): Promise<WorkOrder | null> {
  const { completeWorkOrder } = await import('@/lib/work-orders/work-orders');

  // Complete the work order
  const completed = await completeWorkOrder(workOrderId, actualCost, notes, photos);

  if (!completed) {
    return null;
  }

  // Handle integration (create maintenance history, update asset, etc.)
  try {
    await handleWorkOrderCompletion(workOrderId, organizationId, performedBy);
  } catch (error) {
    console.error('Error handling work order completion integration:', error);
    // Don't fail the completion if integration fails, but log it
  }

  return completed;
}

