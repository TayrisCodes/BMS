'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet } from '@/lib/utils/api-client';
import {
  Activity,
  Database,
  Server,
  Mail,
  MessageSquare,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/lib/components/ui/button';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  timestamp: string;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: string;
  message?: string;
}

interface SystemMetrics {
  activeUsers: number;
  apiRequestRate: number;
  errorRate: number;
  averageResponseTime: number;
}

interface MonitoringData {
  systemHealth: HealthStatus;
  services: ServiceHealth[];
  metrics: SystemMetrics;
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function fetchMonitoringData() {
    try {
      setIsLoading(true);
      setError(null);
      const [healthData, metricsData] = await Promise.all([
        apiGet<{ health: HealthStatus; services: ServiceHealth[] }>('/api/monitoring/health'),
        apiGet<{ metrics: SystemMetrics }>('/api/monitoring/metrics'),
      ]);

      setData({
        systemHealth: healthData.health,
        services: healthData.services,
        metrics: metricsData.metrics,
      });
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchMonitoringData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'down':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  }

  return (
    <DashboardPage
      title="System Monitoring"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Monitoring', href: '/admin/monitoring' },
      ]}
    >
      {/* Header with Refresh */}
      <div className="col-span-full flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={fetchMonitoringData} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Health Status */}
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {data?.systemHealth && getStatusIcon(data.systemHealth.status)}
                <div>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Overall platform health status</CardDescription>
                </div>
              </div>
              {data?.systemHealth && (
                <Badge variant={getStatusBadgeVariant(data.systemHealth.status)}>
                  {data.systemHealth.status.toUpperCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : error ? (
              <p className="text-destructive">{error}</p>
            ) : data?.systemHealth ? (
              <div className="space-y-2">
                <p className="text-sm">{data.systemHealth.message}</p>
                <p className="text-xs text-muted-foreground">
                  Last checked: {new Date(data.systemHealth.timestamp).toLocaleString()}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Metrics Cards */}
      <StatCard
        label="Active Users"
        value={data?.metrics.activeUsers || 0}
        icon={Activity}
        loading={loading}
        error={error}
        onRetry={fetchMonitoringData}
      />
      <StatCard
        label="API Request Rate"
        value={data?.metrics.apiRequestRate ? `${data.metrics.apiRequestRate}/min` : '0/min'}
        icon={Server}
        loading={loading}
        error={error}
        onRetry={fetchMonitoringData}
      />
      <StatCard
        label="Error Rate"
        value={data?.metrics.errorRate ? `${data.metrics.errorRate.toFixed(2)}%` : '0%'}
        icon={AlertCircle}
        loading={loading}
        error={error}
        onRetry={fetchMonitoringData}
      />
      <StatCard
        label="Avg Response Time"
        value={data?.metrics.averageResponseTime ? `${data.metrics.averageResponseTime}ms` : '0ms'}
        icon={Activity}
        loading={loading}
        error={error}
        onRetry={fetchMonitoringData}
      />

      {/* Service Health */}
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
            <CardDescription>Status of critical system services</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading services...</p>
            ) : error ? (
              <p className="text-destructive">{error}</p>
            ) : data?.services && data.services.length > 0 ? (
              <div className="space-y-4">
                {data.services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.message && (
                          <p className="text-sm text-muted-foreground">{service.message}</p>
                        )}
                        {service.responseTime && (
                          <p className="text-xs text-muted-foreground">
                            Response time: {service.responseTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(service.status)}>
                        {service.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(service.lastChecked).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No services configured</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}





