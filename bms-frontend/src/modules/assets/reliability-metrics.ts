import {
  findMaintenanceHistoryByAsset,
  listMaintenanceHistory,
  type MaintenanceHistory,
} from '@/lib/assets/maintenance-history';
import { findAssetById } from '@/lib/assets/assets';

/**
 * Asset reliability metrics calculation module.
 * Calculates maintenance frequency, downtime, cost, and other reliability indicators.
 */

export interface AssetReliabilityMetrics {
  assetId: string;
  periodMonths: number;
  // Frequency metrics
  maintenanceFrequency: number; // Count of maintenance events in period
  averageDaysBetweenMaintenance: number | null;
  // Downtime metrics
  totalDowntimeHours: number;
  averageDowntimeHours: number | null;
  // Cost metrics
  totalMaintenanceCost: number;
  averageCostPerMaintenance: number | null;
  // Time metrics
  lastMaintenanceDate: Date | null;
  daysSinceLastMaintenance: number | null;
  nextMaintenanceDue: Date | null;
  daysUntilNextMaintenance: number | null;
  // Parts usage
  totalPartsCost: number;
  // Maintenance type breakdown
  preventiveCount: number;
  correctiveCount: number;
  emergencyCount: number;
}

/**
 * Calculates maintenance frequency for an asset over a given period.
 */
export async function calculateMaintenanceFrequency(
  assetId: string,
  organizationId: string,
  periodMonths: number = 12,
): Promise<number> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  const history = await listMaintenanceHistory({
    assetId,
    organizationId,
    performedDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  return history.length;
}

/**
 * Calculates total downtime hours for an asset over a given period.
 */
export async function calculateTotalDowntime(
  assetId: string,
  organizationId: string,
  periodMonths: number = 12,
): Promise<number> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  const history = await listMaintenanceHistory({
    assetId,
    organizationId,
    performedDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  return history.reduce((total, h) => total + (h.downtimeHours || 0), 0);
}

/**
 * Calculates total maintenance cost for an asset over a given period.
 */
export async function calculateTotalMaintenanceCost(
  assetId: string,
  organizationId: string,
  periodMonths: number = 12,
): Promise<number> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  const history = await listMaintenanceHistory({
    assetId,
    organizationId,
    performedDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  const costFromHistory = history.reduce((total, h) => total + (h.cost || 0), 0);
  const partsCost = history.reduce((total, h) => {
    if (h.partsUsed) {
      return total + h.partsUsed.reduce((sum, part) => sum + part.cost * part.quantity, 0);
    }
    return total;
  }, 0);

  return costFromHistory + partsCost;
}

/**
 * Gets the last maintenance date for an asset.
 */
export async function getLastMaintenanceDate(
  assetId: string,
  organizationId: string,
): Promise<Date | null> {
  const history = await findMaintenanceHistoryByAsset(assetId, organizationId, 1);
  return history.length > 0 ? history[0].performedDate : null;
}

/**
 * Calculates comprehensive asset reliability metrics.
 */
export async function calculateAssetReliability(
  assetId: string,
  organizationId: string,
  periodMonths: number = 12,
): Promise<AssetReliabilityMetrics> {
  const asset = await findAssetById(assetId, organizationId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  // Get all maintenance history for the period
  const history = await listMaintenanceHistory({
    assetId,
    organizationId,
    performedDate: {
      $gte: startDate,
      $lte: endDate,
    },
  });

  // Calculate frequency
  const maintenanceFrequency = history.length;
  const averageDaysBetweenMaintenance =
    maintenanceFrequency > 1 ? (periodMonths * 30) / (maintenanceFrequency - 1) : null;

  // Calculate downtime
  const totalDowntimeHours = history.reduce((total, h) => total + (h.downtimeHours || 0), 0);
  const averageDowntimeHours =
    maintenanceFrequency > 0 ? totalDowntimeHours / maintenanceFrequency : null;

  // Calculate costs
  const costFromHistory = history.reduce((total, h) => total + (h.cost || 0), 0);
  const totalPartsCost = history.reduce((total, h) => {
    if (h.partsUsed) {
      return total + h.partsUsed.reduce((sum, part) => sum + part.cost * part.quantity, 0);
    }
    return total;
  }, 0);
  const totalMaintenanceCost = costFromHistory + totalPartsCost;
  const averageCostPerMaintenance =
    maintenanceFrequency > 0 ? totalMaintenanceCost / maintenanceFrequency : null;

  // Get last maintenance date
  const lastMaintenanceDate =
    history.length > 0
      ? history[0].performedDate
      : asset.maintenanceSchedule?.lastMaintenanceDate || null;
  const daysSinceLastMaintenance = lastMaintenanceDate
    ? Math.floor(
        (endDate.getTime() - new Date(lastMaintenanceDate).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  // Get next maintenance due
  const nextMaintenanceDue =
    history.length > 0 && history[0].nextMaintenanceDue
      ? history[0].nextMaintenanceDue
      : asset.maintenanceSchedule?.nextMaintenanceDate || null;
  const daysUntilNextMaintenance = nextMaintenanceDue
    ? Math.floor(
        (new Date(nextMaintenanceDue).getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  // Count by maintenance type
  const preventiveCount = history.filter((h) => h.maintenanceType === 'preventive').length;
  const correctiveCount = history.filter((h) => h.maintenanceType === 'corrective').length;
  const emergencyCount = history.filter((h) => h.maintenanceType === 'emergency').length;

  return {
    assetId,
    periodMonths,
    maintenanceFrequency,
    averageDaysBetweenMaintenance,
    totalDowntimeHours,
    averageDowntimeHours,
    totalMaintenanceCost,
    averageCostPerMaintenance,
    lastMaintenanceDate,
    daysSinceLastMaintenance,
    nextMaintenanceDue,
    daysUntilNextMaintenance,
    totalPartsCost,
    preventiveCount,
    correctiveCount,
    emergencyCount,
  };
}

/**
 * Gets a composite reliability score for an asset (0-100, higher is better).
 * Based on maintenance frequency, downtime, and cost efficiency.
 */
export async function getAssetReliabilityScore(
  assetId: string,
  organizationId: string,
  periodMonths: number = 12,
): Promise<number> {
  const metrics = await calculateAssetReliability(assetId, organizationId, periodMonths);

  // Score components (each 0-100)
  let frequencyScore = 100;
  let downtimeScore = 100;
  let costScore = 100;

  // Frequency scoring: Lower frequency is better (fewer maintenance events)
  // Penalize if frequency is too high (> 12 per year = monthly or more)
  if (metrics.maintenanceFrequency > periodMonths) {
    frequencyScore = Math.max(0, 100 - (metrics.maintenanceFrequency - periodMonths) * 10);
  }

  // Downtime scoring: Lower downtime is better
  // Penalize if average downtime > 8 hours per maintenance
  if (metrics.averageDowntimeHours && metrics.averageDowntimeHours > 8) {
    downtimeScore = Math.max(0, 100 - (metrics.averageDowntimeHours - 8) * 5);
  }

  // Cost scoring: Lower cost per maintenance is better
  // This is relative - we'd need asset value or industry benchmarks for accurate scoring
  // For now, penalize if average cost > 10,000 ETB per maintenance
  if (metrics.averageCostPerMaintenance && metrics.averageCostPerMaintenance > 10000) {
    costScore = Math.max(0, 100 - (metrics.averageCostPerMaintenance - 10000) / 100);
  }

  // Weighted average: frequency 30%, downtime 40%, cost 30%
  const compositeScore = frequencyScore * 0.3 + downtimeScore * 0.4 + costScore * 0.3;

  return Math.round(compositeScore);
}
