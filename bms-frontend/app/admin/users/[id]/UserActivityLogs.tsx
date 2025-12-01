'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Button } from '@/lib/components/ui/button';
import { Loader2, Calendar, Activity, Filter, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserActivityAction } from '@/lib/users/user-activity-logs';

interface ActivityLog {
  id: string;
  userId: string;
  organizationId?: string | null;
  action: UserActivityAction;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
  limit: number;
}

const ACTION_LABELS: Record<UserActivityAction, string> = {
  login: 'Login',
  logout: 'Logout',
  password_change: 'Password Changed',
  password_reset: 'Password Reset',
  profile_update: 'Profile Updated',
  role_assigned: 'Role Assigned',
  role_removed: 'Role Removed',
  status_changed: 'Status Changed',
  user_created: 'User Created',
  user_deleted: 'User Deleted',
  user_invited: 'User Invited',
  user_activated: 'User Activated',
  permission_denied: 'Permission Denied',
  other: 'Other',
};

const ACTION_COLORS: Record<UserActivityAction, string> = {
  login: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  password_change: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  password_reset: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  profile_update: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  role_assigned: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  role_removed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  status_changed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  user_created: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  user_deleted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  user_invited: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  user_activated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  permission_denied: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

interface UserActivityLogsProps {
  userId: string;
}

export function UserActivityLogs({ userId }: UserActivityLogsProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '50',
      });

      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }

      if (startDate) {
        params.append('startDate', startDate);
      }

      if (endDate) {
        params.append('endDate', endDate);
      }

      const data = await apiGet<ActivityLogsResponse>(
        `/api/users/${userId}/activity?${params.toString()}`,
      );

      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [userId, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const allActions: UserActivityAction[] = [
    'login',
    'logout',
    'password_change',
    'password_reset',
    'profile_update',
    'role_assigned',
    'role_removed',
    'status_changed',
    'user_created',
    'user_deleted',
    'user_invited',
    'user_activated',
    'permission_denied',
    'other',
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Logs
            </CardTitle>
            <CardDescription>View user activity history and audit trail</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Action Type
            </label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {allActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {ACTION_LABELS[action]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Start Date
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {error && <div className="p-4 rounded-md bg-destructive/10 text-destructive">{error}</div>}

        {/* Activity Logs Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading activity logs...</p>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <p className="text-muted-foreground">No activity logs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action] || ACTION_COLORS.other}>
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.details ? (
                        <details className="cursor-pointer">
                          <summary className="text-muted-foreground hover:text-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-w-md">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {logs.length} of {total} activity logs
          </div>
        )}
      </CardContent>
    </Card>
  );
}
