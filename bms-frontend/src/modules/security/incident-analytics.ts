import {
  listIncidents,
  type SecurityIncident,
  type IncidentType,
  type IncidentSeverity,
  type IncidentStatus,
} from '@/lib/security/incidents';

export interface IncidentStatistics {
  total: number;
  byType: Record<IncidentType, number>;
  bySeverity: Record<IncidentSeverity, number>;
  byStatus: Record<IncidentStatus, number>;
  criticalCount: number;
  highCount: number;
  resolvedCount: number;
  openCount: number;
}

export interface IncidentTrend {
  period: string; // e.g., "2024-01", "2024-01-15"
  count: number;
  byType: Record<IncidentType, number>;
  bySeverity: Record<IncidentSeverity, number>;
}

export interface IncidentAnalytics {
  statistics: IncidentStatistics;
  trends: IncidentTrend[];
  breakdownByType: Record<IncidentType, { count: number; percentage: number }>;
  breakdownBySeverity: Record<IncidentSeverity, { count: number; percentage: number }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get incident statistics for a building or organization.
 */
export async function getIncidentStatistics(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
): Promise<IncidentStatistics> {
  const filters: Record<string, unknown> = {};

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  if (dateRange) {
    filters.reportedAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const incidents = await listIncidents(organizationId, filters);

  const statistics: IncidentStatistics = {
    total: incidents.length,
    byType: {
      theft: 0,
      vandalism: 0,
      trespassing: 0,
      violence: 0,
      suspicious_activity: 0,
      fire: 0,
      medical: 0,
      other: 0,
    },
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    byStatus: {
      reported: 0,
      under_investigation: 0,
      resolved: 0,
      closed: 0,
    },
    criticalCount: 0,
    highCount: 0,
    resolvedCount: 0,
    openCount: 0,
  };

  for (const incident of incidents) {
    // Count by type
    statistics.byType[incident.incidentType]++;

    // Count by severity
    statistics.bySeverity[incident.severity]++;

    // Count by status
    statistics.byStatus[incident.status]++;

    // Count critical and high severity
    if (incident.severity === 'critical') {
      statistics.criticalCount++;
    }
    if (incident.severity === 'high') {
      statistics.highCount++;
    }

    // Count resolved and open
    if (incident.status === 'resolved' || incident.status === 'closed') {
      statistics.resolvedCount++;
    } else {
      statistics.openCount++;
    }
  }

  return statistics;
}

/**
 * Get incident trends over time.
 */
export async function getIncidentTrends(
  buildingId: string | null,
  organizationId: string,
  periodMonths: number = 12,
): Promise<IncidentTrend[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - periodMonths);

  const filters: Record<string, unknown> = {
    reportedAt: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (buildingId) {
    filters.buildingId = buildingId;
  }

  const incidents = await listIncidents(organizationId, filters);

  // Group by month
  const trendsMap = new Map<
    string,
    {
      count: number;
      byType: Record<IncidentType, number>;
      bySeverity: Record<IncidentSeverity, number>;
    }
  >();

  for (const incident of incidents) {
    const date = new Date(incident.reportedAt);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!trendsMap.has(period)) {
      trendsMap.set(period, {
        count: 0,
        byType: {
          theft: 0,
          vandalism: 0,
          trespassing: 0,
          violence: 0,
          suspicious_activity: 0,
          fire: 0,
          medical: 0,
          other: 0,
        },
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
      });
    }

    const trend = trendsMap.get(period)!;
    trend.count++;
    trend.byType[incident.incidentType]++;
    trend.bySeverity[incident.severity]++;
  }

  // Convert to array and sort by period
  const trends: IncidentTrend[] = Array.from(trendsMap.entries())
    .map(([period, data]) => ({
      period,
      count: data.count,
      byType: data.byType,
      bySeverity: data.bySeverity,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return trends;
}

/**
 * Get breakdown of incidents by type.
 */
export async function getIncidentByType(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
): Promise<Record<IncidentType, { count: number; percentage: number }>> {
  const statistics = await getIncidentStatistics(buildingId, organizationId, dateRange);
  const total = statistics.total;

  const breakdown: Record<IncidentType, { count: number; percentage: number }> = {
    theft: { count: 0, percentage: 0 },
    vandalism: { count: 0, percentage: 0 },
    trespassing: { count: 0, percentage: 0 },
    violence: { count: 0, percentage: 0 },
    suspicious_activity: { count: 0, percentage: 0 },
    fire: { count: 0, percentage: 0 },
    medical: { count: 0, percentage: 0 },
    other: { count: 0, percentage: 0 },
  };

  for (const [type, count] of Object.entries(statistics.byType) as [IncidentType, number][]) {
    breakdown[type] = {
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
    };
  }

  return breakdown;
}

/**
 * Get breakdown of incidents by severity.
 */
export async function getIncidentBySeverity(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
): Promise<Record<IncidentSeverity, { count: number; percentage: number }>> {
  const statistics = await getIncidentStatistics(buildingId, organizationId, dateRange);
  const total = statistics.total;

  const breakdown: Record<IncidentSeverity, { count: number; percentage: number }> = {
    low: { count: 0, percentage: 0 },
    medium: { count: 0, percentage: 0 },
    high: { count: 0, percentage: 0 },
    critical: { count: 0, percentage: 0 },
  };

  for (const [severity, count] of Object.entries(statistics.bySeverity) as [
    IncidentSeverity,
    number,
  ][]) {
    breakdown[severity] = {
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
    };
  }

  return breakdown;
}

/**
 * Get comprehensive incident analytics.
 */
export async function getIncidentAnalytics(
  buildingId: string | null,
  organizationId: string,
  dateRange?: DateRange,
  periodMonths: number = 12,
): Promise<IncidentAnalytics> {
  const [statistics, trends, breakdownByType, breakdownBySeverity] = await Promise.all([
    getIncidentStatistics(buildingId, organizationId, dateRange),
    getIncidentTrends(buildingId, organizationId, periodMonths),
    getIncidentByType(buildingId, organizationId, dateRange),
    getIncidentBySeverity(buildingId, organizationId, dateRange),
  ]);

  return {
    statistics,
    trends,
    breakdownByType,
    breakdownBySeverity,
  };
}
