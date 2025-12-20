'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
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
import { BarChart3 } from 'lucide-react';

interface NotificationStatistics {
  total: number;
  byType: Record<string, number>;
  byChannel: {
    in_app: { sent: number; delivered: number; failed: number; read?: number };
    email: { sent: number; delivered: number; failed: number };
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
  };
  deliveryRate: number;
  readRate: number;
}

interface NotificationTrendDataPoint {
  period: string;
  total: number;
  delivered: number;
  read: number;
}

export default function NotificationAnalyticsPage() {
  const [statistics, setStatistics] = useState<NotificationStatistics | null>(null);
  const [trends, setTrends] = useState<NotificationTrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState<'daily' | 'monthly' | 'quarterly'>('monthly');

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          startDate,
          endDate,
          periodType,
        });
        const data = await apiGet<{
          statistics: NotificationStatistics;
          trends: NotificationTrendDataPoint[];
        }>(`/api/notifications/analytics?${params.toString()}`);
        setStatistics(data.statistics);
        setTrends(data.trends);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [startDate, endDate, periodType]);

  return (
    <DashboardPage
      header={{
        title: 'Notification Analytics',
        description: 'Track notification delivery and engagement',
        icon: BarChart3,
      }}
    >
      <div className="col-span-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="periodType">Period Type</Label>
                <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
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
        ) : statistics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{statistics.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Delivery Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{statistics.deliveryRate}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Read Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{statistics.readRate}%</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>By Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {Object.entries(statistics.byChannel).map(([channel, stats]) => (
                    <div key={channel}>
                      <h4 className="font-medium mb-2 capitalize">{channel.replace('_', ' ')}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Sent:</span>
                          <span className="font-medium">{stats.sent}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Delivered:</span>
                          <span className="font-medium text-green-600">{stats.delivered}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failed:</span>
                          <span className="font-medium text-red-600">{stats.failed}</span>
                        </div>
                        {'read' in stats && (
                          <div className="flex justify-between">
                            <span>Read:</span>
                            <span className="font-medium text-blue-600">{stats.read || 0}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(statistics.byType).map(([type, count]) => (
                    <div key={type}>
                      <p className="text-sm text-muted-foreground capitalize">
                        {type.replace('_', ' ')}
                      </p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {trends.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Period</th>
                          <th className="text-right p-2">Total</th>
                          <th className="text-right p-2">Delivered</th>
                          <th className="text-right p-2">Read</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trends.map((trend) => (
                          <tr key={trend.period} className="border-b">
                            <td className="p-2">{trend.period}</td>
                            <td className="text-right p-2">{trend.total}</td>
                            <td className="text-right p-2">{trend.delivered}</td>
                            <td className="text-right p-2">{trend.read}</td>
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

