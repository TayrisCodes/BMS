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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Download, TrendingUp, DollarSign } from 'lucide-react';

interface RevenueDataPoint {
  period: string;
  date: string;
  revenue: number;
  invoiceCount: number;
  paymentCount: number;
}

interface RevenueForecast {
  trend: {
    historical: RevenueDataPoint[];
    forecast: RevenueDataPoint[];
    periodType: string;
  };
  totalHistoricalRevenue: number;
  averageMonthlyRevenue: number;
  projectedRevenue: number;
  growthRate?: number;
}

export default function RevenueTrendsPage() {
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [forecastMonths, setForecastMonths] = useState<string>('3');

  useEffect(() => {
    generateForecast();
  }, []);

  async function generateForecast() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      params.set('period', periodType);
      params.set('forecastMonths', forecastMonths);

      const data = await apiGet<{ forecast: RevenueForecast }>(
        `/api/reports/revenue-trends?${params.toString()}`,
      );
      setForecast(data.forecast);
    } catch (err) {
      console.error('Failed to generate forecast:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <DashboardPage>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Revenue Trends & Forecast</h1>
            <p className="text-muted-foreground">
              Analyze revenue trends and forecast future revenue
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
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
                <Label htmlFor="periodType">Period</Label>
                <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forecastMonths">Forecast Periods</Label>
                <Input
                  id="forecastMonths"
                  type="number"
                  value={forecastMonths}
                  onChange={(e) => setForecastMonths(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={generateForecast} className="w-full" disabled={isLoading}>
                  Generate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {forecast && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Historical Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {forecast.totalHistoricalRevenue.toLocaleString()} ETB
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Average Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {forecast.averageMonthlyRevenue.toLocaleString()} ETB
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Projected Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {forecast.projectedRevenue.toLocaleString()} ETB
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {forecast.growthRate ? `${forecast.growthRate.toFixed(1)}%` : 'N/A'}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historical Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {forecast.trend.historical.map((point) => (
                    <div
                      key={point.period}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="font-medium">{point.period}</span>
                      <span>{point.revenue.toLocaleString()} ETB</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {forecast.trend.forecast.map((point) => (
                    <div
                      key={point.period}
                      className="flex items-center justify-between p-2 border rounded bg-muted/50"
                    >
                      <span className="font-medium">{point.period}</span>
                      <span>{point.revenue.toLocaleString()} ETB</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardPage>
  );
}
