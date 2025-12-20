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
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Users, TrendingUp, Clock, BarChart3 } from 'lucide-react';

interface VisitorAnalytics {
  statistics: {
    total: number;
    active: number;
    averageVisitDuration: number;
    totalVisitDuration: number;
  };
  trends: Array<{
    period: string;
    count: number;
    averageDuration: number;
  }>;
  topHosts: Array<{
    tenantId: string;
    tenantName?: string;
    visitCount: number;
    percentage: number;
  }>;
  byPurpose: Array<{
    purpose: string;
    count: number;
    percentage: number;
  }>;
  byTimeOfDay: Array<{
    hour: number;
    count: number;
    percentage: number;
  }>;
}

interface Building {
  _id: string;
  name: string;
}

export default function VisitorReportsPage() {
  const [analytics, setAnalytics] = useState<VisitorAnalytics | null>(null);
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

        const data = await apiGet<VisitorAnalytics>(
          `/api/visitor-logs/analytics?${params.toString()}`,
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
      title="Visitor Reports & Analytics"
      description="View visitor statistics and trends"
      icon={<Users className="h-5 w-5" />}
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
                  <CardDescription>Total Visitors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.statistics.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Visitors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.statistics.active}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg. Visit Duration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(analytics.statistics.averageVisitDuration)} min
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Visit Time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(analytics.statistics.totalVisitDuration / 60)} hrs
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Hosts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.topHosts.map((host, index) => (
                      <div key={host.tenantId} className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">#{index + 1}</span>
                          <span className="ml-2">
                            {host.tenantName || `Tenant ${host.tenantId.slice(-6)}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{host.visitCount} visits</span>
                          <span className="text-sm text-muted-foreground">
                            ({host.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    By Purpose
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.byPurpose.map((item) => (
                      <div key={item.purpose} className="flex items-center justify-between">
                        <span className="text-sm">{item.purpose}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.count}</span>
                          <span className="text-sm text-muted-foreground">
                            ({item.percentage}%)
                          </span>
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
                  <Clock className="h-5 w-5" />
                  Peak Visiting Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                  {analytics.byTimeOfDay.slice(0, 12).map((item) => (
                    <div key={item.hour} className="text-center p-2 border rounded">
                      <div className="text-xs font-medium">{item.hour}:00</div>
                      <div className="text-sm font-bold">{item.count}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                        <div className="flex items-center gap-4">
                          <span className="text-sm">
                            <strong>{trend.count}</strong> visitors
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Avg. duration: {Math.round(trend.averageDuration)} min
                          </span>
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

