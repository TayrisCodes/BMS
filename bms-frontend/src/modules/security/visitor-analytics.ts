import { listVisitorLogs, type VisitorLog } from '@/lib/security/visitor-logs';

export interface VisitorStatistics {
  total: number;
  active: number;
  averageVisitDuration: number; // in minutes
  totalVisitDuration: number; // in minutes
}

export interface VisitorTrend {
  period: string; // e.g., "2024-01", "2024-01-15"
  count: number;
  averageDuration: number;
}

export interface TopHost {
  tenantId: string;
  tenantName?: string;
  visitCount: number;
  percentage: number;
}

export interface VisitorByPurpose {
  purpose: string;
  count: number;
  percentage: number;
}

export interface VisitorByTimeOfDay {
  hour: number; // 0-23
  count: number;
  percentage: number;
}

export interface VisitorAnalytics {
  statistics: VisitorStatistics;
  trends: VisitorTrend[];
  topHosts: TopHost[];
  byPurpose: VisitorByPurpose[];
  byTimeOfDay: VisitorByTimeOfDay[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get visitor statistics for a building or organization.
 */
export async function getVisitorStatistics(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
): Promise<VisitorStatistics> {
  const filters: Record<string, unknown> = {};

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  if (dateRange) {
    filters.entryTime = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const visitorLogs = await listVisitorLogs({
    organizationId,
    ...filters,
  });

  let totalDuration = 0;
  let completedVisits = 0;
  let activeVisits = 0;

  for (const log of visitorLogs) {
    if (log.exitTime) {
      const duration = (log.exitTime.getTime() - log.entryTime.getTime()) / (1000 * 60); // minutes
      totalDuration += duration;
      completedVisits++;
    } else {
      activeVisits++;
    }
  }

  const averageDuration = completedVisits > 0 ? totalDuration / completedVisits : 0;

  return {
    total: visitorLogs.length,
    active: activeVisits,
    averageVisitDuration: Math.round(averageDuration * 100) / 100,
    totalVisitDuration: Math.round(totalDuration * 100) / 100,
  };
}

/**
 * Get visitor trends over time.
 */
export async function getVisitorTrends(
  buildingId: string | null,
  organizationId: string,
  periodMonths: number = 12,
): Promise<VisitorTrend[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  const filters: Record<string, unknown> = {
    entryTime: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  const visitorLogs = await listVisitorLogs({
    organizationId,
    ...filters,
  });

  // Group by month
  const trendsMap = new Map<
    string,
    {
      count: number;
      totalDuration: number;
      completedCount: number;
    }
  >();

  for (const log of visitorLogs) {
    const date = new Date(log.entryTime);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!trendsMap.has(period)) {
      trendsMap.set(period, {
        count: 0,
        totalDuration: 0,
        completedCount: 0,
      });
    }

    const trend = trendsMap.get(period)!;
    trend.count++;

    if (log.exitTime) {
      const duration = (log.exitTime.getTime() - log.entryTime.getTime()) / (1000 * 60); // minutes
      trend.totalDuration += duration;
      trend.completedCount++;
    }
  }

  // Convert to array and sort by period
  const trends: VisitorTrend[] = Array.from(trendsMap.entries())
    .map(([period, data]) => ({
      period,
      count: data.count,
      averageDuration:
        data.completedCount > 0
          ? Math.round((data.totalDuration / data.completedCount) * 100) / 100
          : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return trends;
}

/**
 * Get top hosts (tenants with most visitors).
 */
export async function getTopHosts(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
  limit: number = 10,
): Promise<TopHost[]> {
  const filters: Record<string, unknown> = {};

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  if (dateRange) {
    filters.entryTime = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const visitorLogs = await listVisitorLogs({
    organizationId,
    ...filters,
  });

  // Count visits per tenant
  const hostCounts = new Map<string, number>();
  for (const log of visitorLogs) {
    const count = hostCounts.get(log.hostTenantId) || 0;
    hostCounts.set(log.hostTenantId, count + 1);
  }

  // Convert to array and sort
  const topHosts: TopHost[] = Array.from(hostCounts.entries())
    .map(([tenantId, visitCount]) => ({
      tenantId,
      visitCount,
      percentage:
        visitorLogs.length > 0
          ? Math.round((visitCount / visitorLogs.length) * 100 * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, limit);

  return topHosts;
}

/**
 * Get breakdown of visitors by purpose.
 */
export async function getVisitorByPurpose(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
): Promise<VisitorByPurpose[]> {
  const filters: Record<string, unknown> = {};

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  if (dateRange) {
    filters.entryTime = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const visitorLogs = await listVisitorLogs({
    organizationId,
    ...filters,
  });

  // Count by purpose
  const purposeCounts = new Map<string, number>();
  for (const log of visitorLogs) {
    const purpose = log.purpose.trim();
    const count = purposeCounts.get(purpose) || 0;
    purposeCounts.set(purpose, count + 1);
  }

  // Convert to array and sort
  const byPurpose: VisitorByPurpose[] = Array.from(purposeCounts.entries())
    .map(([purpose, count]) => ({
      purpose,
      count,
      percentage:
        visitorLogs.length > 0 ? Math.round((count / visitorLogs.length) * 100 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return byPurpose;
}

/**
 * Get breakdown of visitors by time of day.
 */
export async function getVisitorByTimeOfDay(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
): Promise<VisitorByTimeOfDay[]> {
  const filters: Record<string, unknown> = {};

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  if (dateRange) {
    filters.entryTime = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const visitorLogs = await listVisitorLogs({
    organizationId,
    ...filters,
  });

  // Count by hour (0-23)
  const hourCounts = new Map<number, number>();
  for (const log of visitorLogs) {
    const hour = new Date(log.entryTime).getHours();
    const count = hourCounts.get(hour) || 0;
    hourCounts.set(hour, count + 1);
  }

  // Convert to array for all hours (0-23) and sort
  const byTimeOfDay: VisitorByTimeOfDay[] = Array.from({ length: 24 }, (_, hour) => {
    const count = hourCounts.get(hour) || 0;
    return {
      hour,
      count,
      percentage:
        visitorLogs.length > 0 ? Math.round((count / visitorLogs.length) * 100 * 100) / 100 : 0,
    };
  }).sort((a, b) => b.count - a.count);

  return byTimeOfDay;
}

/**
 * Get comprehensive visitor analytics.
 */
export async function getVisitorAnalytics(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
  periodMonths: number = 12,
  topHostsLimit: number = 10,
): Promise<VisitorAnalytics> {
  const [statistics, trends, topHosts, byPurpose, byTimeOfDay] = await Promise.all([
    getVisitorStatistics(buildingId, organizationId, dateRange),
    getVisitorTrends(buildingId, organizationId, periodMonths),
    getTopHosts(buildingId, organizationId, dateRange, topHostsLimit),
    getVisitorByPurpose(buildingId, organizationId, dateRange),
    getVisitorByTimeOfDay(buildingId, organizationId, dateRange),
  ]);

  return {
    statistics,
    trends,
    topHosts,
    byPurpose,
    byTimeOfDay,
  };
}

