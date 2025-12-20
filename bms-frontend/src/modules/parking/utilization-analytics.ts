import { findParkingSpacesByBuilding } from '@/lib/parking/parking-spaces';
import { listParkingAssignments, findActiveAssignments } from '@/lib/parking/parking-assignments';
import { listParkingViolations } from '@/lib/parking/parking-violations';
import type { ParkingSpaceType } from '@/lib/parking/parking-spaces';

export interface UtilizationStatistics {
  overallUtilization: number; // Percentage
  bySpaceType: Record<
    ParkingSpaceType,
    {
      total: number;
      occupied: number;
      utilization: number; // Percentage
    }
  >;
  peakUtilization: {
    time: string; // Hour of day
    utilization: number;
  };
  revenueByType: Record<ParkingSpaceType, number>;
  violationFrequency: number; // Violations per 100 spaces
}

export interface UtilizationTrendDataPoint {
  period: string; // e.g., "2024-01", "2024-Q1"
  utilization: number; // Percentage
  occupied: number;
  total: number;
}

/**
 * Helper to format date to period string.
 */
function formatPeriod(date: Date, periodType: 'daily' | 'monthly' | 'quarterly'): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;

  switch (periodType) {
    case 'daily':
      return `${year}-${month.toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month.toString().padStart(2, '0')}`;
    case 'quarterly':
      return `${year}-Q${quarter}`;
    default:
      return `${year}`;
  }
}

/**
 * Get utilization statistics for a building.
 */
export async function getUtilizationStatistics(
  organizationId: string,
  buildingId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<UtilizationStatistics> {
  // Get all parking spaces
  const spaces = await findParkingSpacesByBuilding(buildingId, organizationId);

  // Get active assignments
  const activeAssignments = await findActiveAssignments({
    organizationId,
    buildingId,
  });

  // Get completed assignments for revenue calculation
  const completedAssignments = await listParkingAssignments({
    organizationId,
    buildingId,
    status: 'completed',
  });

  // Filter by date range if provided
  let filteredAssignments = completedAssignments;
  if (startDate || endDate) {
    filteredAssignments = completedAssignments.filter((a) => {
      const endTime = a.actualEndTime || a.endDate || a.updatedAt;
      const end = endTime instanceof Date ? endTime : new Date(endTime);
      if (startDate && end < startDate) return false;
      if (endDate && end > endDate) return false;
      return true;
    });
  }

  // Get violations for violation frequency
  const violations = await listParkingViolations(organizationId, {
    buildingId,
    ...(startDate && { reportedAt: { $gte: startDate } }),
    ...(endDate && { reportedAt: { ...(startDate ? {} : {}), $lte: endDate } }),
  });

  // Calculate utilization by space type
  const bySpaceType: Record<
    ParkingSpaceType,
    { total: number; occupied: number; utilization: number }
  > = {
    tenant: { total: 0, occupied: 0, utilization: 0 },
    visitor: { total: 0, occupied: 0, utilization: 0 },
    reserved: { total: 0, occupied: 0, utilization: 0 },
  };

  const assignedSpaceIds = new Set(activeAssignments.map((a) => a.parkingSpaceId));

  for (const space of spaces) {
    const type = space.spaceType;
    if (type === 'tenant' || type === 'visitor' || type === 'reserved') {
      bySpaceType[type].total++;
      if (assignedSpaceIds.has(space._id) || space.status === 'occupied') {
        bySpaceType[type].occupied++;
      }
    }
  }

  // Calculate utilization percentages
  for (const type of ['tenant', 'visitor', 'reserved'] as ParkingSpaceType[]) {
    bySpaceType[type].utilization =
      bySpaceType[type].total > 0
        ? Math.round((bySpaceType[type].occupied / bySpaceType[type].total) * 100)
        : 0;
  }

  // Calculate overall utilization
  const totalSpaces = spaces.length;
  const totalOccupied =
    activeAssignments.length + spaces.filter((s) => s.status === 'occupied').length;
  const overallUtilization = totalSpaces > 0 ? Math.round((totalOccupied / totalSpaces) * 100) : 0;

  // Calculate revenue by type
  const revenueByType: Record<ParkingSpaceType, number> = {
    tenant: 0,
    visitor: 0,
    reserved: 0,
  };

  // Get space types for assignments (would need to fetch spaces, simplified here)
  for (const assignment of filteredAssignments) {
    // For simplicity, use assignment type as proxy for space type
    const type = assignment.assignmentType === 'tenant' ? 'tenant' : 'visitor';
    if (type === 'tenant' || type === 'visitor') {
      // Calculate revenue from assignment (simplified - would need to check if invoiced)
      const hours = assignment.calculatedDuration
        ? Math.ceil(assignment.calculatedDuration / 60)
        : 1;
      const amount =
        assignment.billingPeriod === 'hourly' ? assignment.rate * hours : assignment.rate;
      revenueByType[type] += amount;
    }
  }

  // Calculate violation frequency (violations per 100 spaces)
  const violationFrequency =
    totalSpaces > 0 ? Math.round((violations.length / totalSpaces) * 100 * 100) / 100 : 0;

  // Calculate peak utilization (simplified - would need hourly breakdown)
  const peakUtilization = {
    time: '12:00', // Placeholder - would need hourly analysis
    utilization: overallUtilization,
  };

  return {
    overallUtilization,
    bySpaceType,
    peakUtilization,
    revenueByType,
    violationFrequency,
  };
}

/**
 * Get utilization trends over time.
 */
export async function getUtilizationTrends(
  organizationId: string,
  buildingId: string,
  periodType: 'daily' | 'monthly' | 'quarterly' = 'monthly',
  numPeriods: number = 12,
): Promise<UtilizationTrendDataPoint[]> {
  const spaces = await findParkingSpacesByBuilding(buildingId, organizationId);
  const totalSpaces = spaces.length;

  if (totalSpaces === 0) {
    return [];
  }

  const assignments = await listParkingAssignments({
    organizationId,
    buildingId,
  });

  const trendMap: Record<string, { occupied: number; total: number }> = {};

  for (const assignment of assignments) {
    const startDate = assignment.actualStartTime || assignment.startDate;
    const endDate = assignment.actualEndTime || assignment.endDate || new Date();

    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    // For each period the assignment was active, count it as occupied
    const periods = new Set<string>();
    const current = new Date(start);
    while (current <= end) {
      periods.add(formatPeriod(current, periodType));
      if (periodType === 'daily') current.setDate(current.getDate() + 1);
      if (periodType === 'monthly') current.setMonth(current.getMonth() + 1);
      if (periodType === 'quarterly') current.setMonth(current.getMonth() + 3);
    }

    for (const period of periods) {
      if (!trendMap[period]) {
        trendMap[period] = { occupied: 0, total: totalSpaces };
      }
      trendMap[period].occupied++;
    }
  }

  const trends: UtilizationTrendDataPoint[] = [];
  const now = new Date();

  for (let i = 0; i < numPeriods; i++) {
    const date = new Date(now);
    if (periodType === 'daily') date.setDate(now.getDate() - i);
    if (periodType === 'monthly') date.setMonth(now.getMonth() - i);
    if (periodType === 'quarterly') date.setMonth(now.getMonth() - i * 3);

    const period = formatPeriod(date, periodType);
    const data = trendMap[period] || { occupied: 0, total: totalSpaces };
    const utilization = data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0;

    trends.unshift({
      period,
      utilization,
      occupied: data.occupied,
      total: data.total,
    });
  }

  return trends;
}
