'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
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
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { TrendingUp } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
}

interface UtilizationStatistics {
  overallUtilization: number;
  bySpaceType: {
    tenant: { total: number; occupied: number; utilization: number };
    visitor: { total: number; occupied: number; utilization: number };
    reserved: { total: number; occupied: number; utilization: number };
  };
  peakUtilization: { time: string; utilization: number };
  revenueByType: { tenant: number; visitor: number; reserved: number };
  violationFrequency: number;
}

interface UtilizationTrendDataPoint {
  period: string;
  utilization: number;
  occupied: number;
  total: number;
}

export default function UtilizationReportPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [startDate, setStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statistics, setStatistics] = useState<UtilizationStatistics | null>(null);
  const [trends, setTrends] = useState<UtilizationTrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const data = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(data.buildings || []);
        if (data.buildings && data.buildings.length > 0) {
          setSelectedBuilding(data.buildings[0]._id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load buildings');
      }
    }
    fetchBuildings();
  }, []);

  useEffect(() => {
    async function fetchReport() {
      if (!selectedBuilding) return;

      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          buildingId: selectedBuilding,
          startDate,
          endDate,
        });
        const data = await apiGet<{
          statistics: UtilizationStatistics;
          trends: UtilizationTrendDataPoint[];
        }>(`/api/parking/reports/utilization?${params.toString()}`);
        setStatistics(data.statistics);
        setTrends(data.trends);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load utilization report');
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [selectedBuilding, startDate, endDate]);

  return (
    <DashboardPage
      header={{
        title: 'Parking Utilization Report',
        description: 'Analyze parking space utilization and trends',
        icon: TrendingUp,
      }}
    >
      <div className="col-span-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="building">Building</Label>
                <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading report...</p>
          </div>
        ) : statistics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{statistics.overallUtilization}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Violation Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {statistics.violationFrequency.toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground">per 100 spaces</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {statistics.peakUtilization.utilization}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    at {statistics.peakUtilization.time}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Utilization by Space Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Tenant Spaces</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm">Total:</span>
                        <span className="font-medium">{statistics.bySpaceType.tenant.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Occupied:</span>
                        <span className="font-medium">
                          {statistics.bySpaceType.tenant.occupied}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Utilization:</span>
                        <span className="font-medium">
                          {statistics.bySpaceType.tenant.utilization}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Visitor Spaces</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm">Total:</span>
                        <span className="font-medium">{statistics.bySpaceType.visitor.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Occupied:</span>
                        <span className="font-medium">
                          {statistics.bySpaceType.visitor.occupied}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Utilization:</span>
                        <span className="font-medium">
                          {statistics.bySpaceType.visitor.utilization}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Reserved Spaces</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm">Total:</span>
                        <span className="font-medium">{statistics.bySpaceType.reserved.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Occupied:</span>
                        <span className="font-medium">
                          {statistics.bySpaceType.reserved.occupied}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Utilization:</span>
                        <span className="font-medium">
                          {statistics.bySpaceType.reserved.utilization}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Space Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tenant</p>
                    <p className="text-2xl font-bold">
                      ETB {statistics.revenueByType.tenant.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Visitor</p>
                    <p className="text-2xl font-bold">
                      ETB {statistics.revenueByType.visitor.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reserved</p>
                    <p className="text-2xl font-bold">
                      ETB {statistics.revenueByType.reserved.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {trends.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Utilization Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Period</th>
                          <th className="text-right p-2">Utilization</th>
                          <th className="text-right p-2">Occupied</th>
                          <th className="text-right p-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trends.map((trend) => (
                          <tr key={trend.period} className="border-b">
                            <td className="p-2">{trend.period}</td>
                            <td className="text-right p-2">{trend.utilization}%</td>
                            <td className="text-right p-2">{trend.occupied}</td>
                            <td className="text-right p-2">{trend.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </DashboardPage>
  );
}
