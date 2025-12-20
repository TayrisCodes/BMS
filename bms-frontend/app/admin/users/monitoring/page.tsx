'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import {
  Activity,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import { useToast } from '@/lib/components/ui/use-toast';

interface ActivityStats {
  overview: {
    totalActivities: number;
    activeUsers: number;
    inactiveUsers: number;
    totalUsers: number;
  };
  byAction: Record<string, number>;
  topActiveUsers: Array<{
    userId: string;
    userName: string;
    activityCount: number;
    lastActivity: string;
  }>;
}

interface InactiveUser {
  id: string;
  name?: string;
  email?: string;
  phone: string;
  roles: string[];
  lastLoginAt: string | null;
  daysSinceLastLogin: number | null;
}

interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  userId?: string;
  userName?: string;
  count?: number;
  details?: Record<string, unknown>;
}

export default function UserMonitoringPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [daysFilter, setDaysFilter] = useState('30');
  const [inactiveDaysFilter, setInactiveDaysFilter] = useState('90');

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<ActivityStats>(`/api/users/monitoring/stats?days=${daysFilter}`);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      toast({
        title: 'Error',
        description: 'Failed to load activity statistics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [daysFilter, toast]);

  const fetchInactiveUsers = useCallback(async () => {
    try {
      const data = await apiGet<{ inactiveUsers: InactiveUser[] }>(
        `/api/users/monitoring/inactive?days=${inactiveDaysFilter}`,
      );
      setInactiveUsers(data.inactiveUsers || []);
    } catch (err) {
      console.error('Failed to fetch inactive users:', err);
    }
  }, [inactiveDaysFilter]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiGet<{ alerts: SecurityAlert[] }>('/api/users/monitoring/alerts');
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchInactiveUsers();
    fetchAlerts();
  }, [fetchStats, fetchInactiveUsers, fetchAlerts]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  if (loading && !stats) {
    return (
      <div className="container mx-auto p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground mt-4">Loading activity monitoring...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">User Activity Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor user activity, identify inactive users, and track security alerts
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overview.totalActivities}</div>
              <p className="text-xs text-muted-foreground">Last {daysFilter} days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.overview.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Logged in last 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overview.inactiveUsers}</div>
              <p className="text-xs text-muted-foreground">No login in 90+ days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overview.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Active status</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activity by Action */}
      {stats && Object.keys(stats.byAction).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Activity by Action Type</CardTitle>
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byAction)
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between">
                    <span className="text-sm">{action.replace(/_/g, ' ')}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Active Users */}
      {stats && stats.topActiveUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Activity Count</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topActiveUsers.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.activityCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.lastActivity).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Security Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="p-3 border rounded-lg flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity}
                      </Badge>
                      <span className="text-sm font-medium">{alert.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                    {alert.userName && (
                      <p className="text-xs text-muted-foreground mt-1">User: {alert.userName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inactive Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inactive Users</CardTitle>
            <Select value={inactiveDaysFilter} onValueChange={setInactiveDaysFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30+ days</SelectItem>
                <SelectItem value="60">60+ days</SelectItem>
                <SelectItem value="90">90+ days</SelectItem>
                <SelectItem value="180">180+ days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {inactiveUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No inactive users found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Days Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || user.email || 'N/A'}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {user.daysSinceLastLogin !== null
                          ? `${user.daysSinceLastLogin} days`
                          : 'N/A'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

