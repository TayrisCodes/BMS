import { listParkingAssignments } from '@/lib/parking/parking-assignments';
import { listParkingLogs } from '@/lib/parking/parking-logs';
import type { ParkingSpaceType } from '@/lib/parking/parking-spaces';

export interface DurationStatistics {
  averageDurationMinutes: number;
  medianDurationMinutes: number;
  longestStayMinutes: number;
  shortestStayMinutes: number;
  totalStays: number;
  bySpaceType: Record<
    ParkingSpaceType,
    {
      averageDurationMinutes: number;
      totalStays: number;
    }
  >;
}

export interface PeakHoursData {
  hour: number; // 0-23
  count: number;
  averageDurationMinutes: number;
}

export interface DurationTrendDataPoint {
  period: string; // e.g., "2024-01", "2024-Q1"
  averageDurationMinutes: number;
  totalStays: number;
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
 * Get duration statistics for parking assignments.
 */
export async function getDurationStatistics(
  organizationId: string,
  buildingId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<DurationStatistics> {
  const filters: Record<string, unknown> = {
    status: 'completed',
  };
  if (buildingId) filters.buildingId = buildingId;
  if (startDate) filters.endDate = { $gte: startDate };
  if (endDate) filters.endDate = { ...filters.endDate, $lte: endDate };

  const assignments = await listParkingAssignments({
    organizationId,
    ...filters,
  });

  const durations: number[] = [];
  const durationsByType: Record<string, number[]> = {};

  for (const assignment of assignments) {
    if (assignment.calculatedDuration !== null && assignment.calculatedDuration !== undefined) {
      durations.push(assignment.calculatedDuration);

      // Get space type from parking space (would need to fetch, but for now use assignment type as proxy)
      const type = assignment.assignmentType === 'tenant' ? 'tenant' : 'visitor';
      if (!durationsByType[type]) {
        durationsByType[type] = [];
      }
      durationsByType[type].push(assignment.calculatedDuration);
    }
  }

  const sortedDurations = durations.sort((a, b) => a - b);
  const average =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const median =
    sortedDurations.length > 0 ? sortedDurations[Math.floor(sortedDurations.length / 2)] : 0;

  const bySpaceType: Record<
    ParkingSpaceType,
    { averageDurationMinutes: number; totalStays: number }
  > = {
    tenant: { averageDurationMinutes: 0, totalStays: 0 },
    visitor: { averageDurationMinutes: 0, totalStays: 0 },
    reserved: { averageDurationMinutes: 0, totalStays: 0 },
  };

  for (const [type, typeDurations] of Object.entries(durationsByType)) {
    if (type === 'tenant' || type === 'visitor' || type === 'reserved') {
      bySpaceType[type] = {
        averageDurationMinutes:
          typeDurations.length > 0
            ? typeDurations.reduce((a, b) => a + b, 0) / typeDurations.length
            : 0,
        totalStays: typeDurations.length,
      };
    }
  }

  return {
    averageDurationMinutes: Math.round(average),
    medianDurationMinutes: Math.round(median),
    longestStayMinutes:
      sortedDurations.length > 0 ? sortedDurations[sortedDurations.length - 1] : 0,
    shortestStayMinutes: sortedDurations.length > 0 ? sortedDurations[0] : 0,
    totalStays: durations.length,
    bySpaceType,
  };
}

/**
 * Get peak parking hours based on entry logs.
 */
export async function getPeakParkingHours(
  organizationId: string,
  buildingId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<PeakHoursData[]> {
  const filters: Record<string, unknown> = {
    logType: 'entry',
  };
  if (buildingId) filters.buildingId = buildingId;
  if (startDate) filters.timestamp = { $gte: startDate };
  if (endDate) filters.timestamp = { ...filters.timestamp, $lte: endDate };

  const logs = await listParkingLogs(organizationId, filters);

  const hourCounts: Record<number, { count: number; totalDuration: number; durations: number[] }> =
    {};

  for (const log of logs) {
    const timestamp = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
    const hour = timestamp.getHours();

    if (!hourCounts[hour]) {
      hourCounts[hour] = { count: 0, totalDuration: 0, durations: [] };
    }

    hourCounts[hour].count++;

    // Try to get duration from exit log or assignment
    if (log.duration) {
      hourCounts[hour].totalDuration += log.duration;
      hourCounts[hour].durations.push(log.duration);
    }
  }

  const peakHours: PeakHoursData[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const data = hourCounts[hour] || { count: 0, totalDuration: 0, durations: [] };
    const averageDuration =
      data.durations.length > 0
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        : 0;

    peakHours.push({
      hour,
      count: data.count,
      averageDurationMinutes: Math.round(averageDuration),
    });
  }

  return peakHours.sort((a, b) => b.count - a.count);
}

/**
 * Get duration trends over time.
 */
export async function getDurationTrends(
  organizationId: string,
  buildingId?: string,
  periodType: 'daily' | 'monthly' | 'quarterly' = 'monthly',
  numPeriods: number = 12,
): Promise<DurationTrendDataPoint[]> {
  const filters: Record<string, unknown> = {
    status: 'completed',
  };
  if (buildingId) filters.buildingId = buildingId;

  const assignments = await listParkingAssignments({
    organizationId,
    ...filters,
  });

  const trendMap: Record<string, { totalDuration: number; count: number }> = {};

  for (const assignment of assignments) {
    if (assignment.calculatedDuration !== null && assignment.calculatedDuration !== undefined) {
      const endDate = assignment.actualEndTime || assignment.endDate || assignment.updatedAt;
      const period = formatPeriod(
        endDate instanceof Date ? endDate : new Date(endDate),
        periodType,
      );

      if (!trendMap[period]) {
        trendMap[period] = { totalDuration: 0, count: 0 };
      }

      trendMap[period].totalDuration += assignment.calculatedDuration;
      trendMap[period].count++;
    }
  }

  const trends: DurationTrendDataPoint[] = [];
  const now = new Date();

  for (let i = 0; i < numPeriods; i++) {
    const date = new Date(now);
    if (periodType === 'daily') date.setDate(now.getDate() - i);
    if (periodType === 'monthly') date.setMonth(now.getMonth() - i);
    if (periodType === 'quarterly') date.setMonth(now.getMonth() - i * 3);

    const period = formatPeriod(date, periodType);
    const data = trendMap[period] || { totalDuration: 0, count: 0 };
    const averageDuration = data.count > 0 ? data.totalDuration / data.count : 0;

    trends.unshift({
      period,
      averageDurationMinutes: Math.round(averageDuration),
      totalStays: data.count,
    });
  }

  return trends;
}

