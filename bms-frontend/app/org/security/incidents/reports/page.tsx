'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { FileText, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

interface IncidentAnalytics {
  statistics: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    criticalCount: number;
    highCount: number;
    resolvedCount: number;
    openCount: number;
  };
  trends: Array<{
    period: string;
    count: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }>;
  breakdownByType: Record<string, { count: number; percentage: number }>;
  breakdownBySeverity: Record<string, { count: number; percentage: number }>;
}

interface Building {
  _id: string;
  name: string;
}

export default function IncidentReportsPage() {
  const [analytics, setAnalytics] = useState<IncidentAnalytics | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    buildingId: '',
    startDate: '',
    endDate: '',
    periodMonths: '12',
  });

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const data = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(data.buildings || []);
      } catch (err) {
        console.error('Failed to fetch buildings', err);
      }
    }
    fetchBuildings();
  }, []);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (filters.buildingId) params.append('buildingId', filters.buildingId);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        params.append('periodMonths', filters.periodMonths);

        const data = await apiGet<IncidentAnalytics>(
          `/api/security/incidents/analytics?${params.toString()}`,
        );
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [filters]);

  return (
    <DashboardPage
      title="Incident Reports & Analytics"
      description="View security incident statistics and trends"
      icon={<FileText className="h-5 w-5" />}
    >
      <div className="col-span-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Building</Label>
                <Select
                  value={filters.buildingId}
                  onValueChange={(value) => setFilters({ ...filters, buildingId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Buildings</SelectItem>
                    {buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Period (Months)</Label>
                <Select
                  value={filters.periodMonths}
                  onValueChange={(value) => setFilters({ ...filters, periodMonths: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                    <SelectItem value="24">24 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Incidents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.statistics.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Critical & High</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">
                    {analytics.statistics.criticalCount + analytics.statistics.highCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resolved</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.statistics.resolvedCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Open</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.statistics.openCount}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Breakdown by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.breakdownByType)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([type, data]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{data.count}</span>
                            <Badge variant="secondary">{data.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Breakdown by Severity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.breakdownBySeverity)
                      .sort((a, b) => {
                        const order = ['critical', 'high', 'medium', 'low'];
                        return order.indexOf(a[0]) - order.indexOf(b[0]);
                      })
                      .map(([severity, data]) => (
                        <div key={severity} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{severity}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{data.count}</span>
                            <Badge variant="secondary">{data.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trends Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.trends.map((trend) => (
                    <div key={trend.period} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{trend.period}</span>
                        <Badge>{trend.count} incidents</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">By Type:</p>
                          <div className="space-y-1">
                            {Object.entries(trend.byType)
                              .filter(([_, count]) => count > 0)
                              .map(([type, count]) => (
                                <div key={type} className="flex justify-between">
                                  <span className="capitalize">{type.replace('_', ' ')}</span>
                                  <span>{count}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">By Severity:</p>
                          <div className="space-y-1">
                            {Object.entries(trend.bySeverity)
                              .filter(([_, count]) => count > 0)
                              .map(([severity, count]) => (
                                <div key={severity} className="flex justify-between">
                                  <span className="capitalize">{severity}</span>
                                  <span>{count}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardPage>
  );
}
