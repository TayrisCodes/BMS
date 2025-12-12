'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/lib/components/ui/button';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import {
  Loader2,
  FileCheck,
  Calendar,
  Activity,
  Filter,
  RefreshCw,
  Search,
  User,
  Download,
  Eye,
  X,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import type { UserActivityAction } from '@/lib/users/user-activity-logs';

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  userPhone: string | null;
  organizationId: string | null;
  action: UserActivityAction;
  details?: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
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

const ACTION_COLORS: Record<
  UserActivityAction,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  login: 'default',
  logout: 'secondary',
  password_change: 'default',
  password_reset: 'outline',
  profile_update: 'default',
  role_assigned: 'default',
  role_removed: 'outline',
  status_changed: 'outline',
  user_created: 'default',
  user_deleted: 'destructive',
  user_invited: 'default',
  user_activated: 'default',
  permission_denied: 'destructive',
  other: 'secondary',
};

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

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [userId, setUserId] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (userId) {
        params.append('userId', userId);
      }

      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }

      if (startDate) {
        params.append('startDate', startDate);
      }

      if (endDate) {
        params.append('endDate', endDate);
      }

      if (organizationFilter) {
        params.append('organizationId', organizationFilter);
      }

      const data = await apiGet<AuditLogsResponse>(`/api/admin/audit-logs?${params.toString()}`);

      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [userId, actionFilter, startDate, endDate, limit, offset, organizationFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchLogs();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchLogs, loading]);

  // Filter logs by search term (client-side for user name/email/phone)
  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.userName.toLowerCase().includes(search) ||
      log.userEmail?.toLowerCase().includes(search) ||
      log.userPhone?.toLowerCase().includes(search) ||
      log.ipAddress?.toLowerCase().includes(search) ||
      ACTION_LABELS[log.action]?.toLowerCase().includes(search)
    );
  });

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        [
          'Timestamp',
          'User',
          'Email',
          'Phone',
          'Action',
          'IP Address',
          'Organization ID',
          'Details',
        ].join(','),
        ...filteredLogs.map((log) =>
          [
            new Date(log.createdAt).toISOString(),
            `"${log.userName}"`,
            `"${log.userEmail || ''}"`,
            `"${log.userPhone || ''}"`,
            `"${ACTION_LABELS[log.action] || log.action}"`,
            `"${log.ipAddress || ''}"`,
            `"${log.organizationId || ''}"`,
            log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : '',
          ].join(','),
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  return (
    <DashboardPage
      title="Audit Logs"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Audit Logs', href: '/admin/audit-logs' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Activity Logs
                </CardTitle>
                <CardDescription>
                  Comprehensive audit trail of all system activities ({total} total logs)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={loading || filteredLogs.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </label>
                <Input
                  placeholder="Search by name, email, phone, IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  User ID
                </label>
                <Input
                  placeholder="Filter by user ID"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setOffset(0);
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Action Type
                </label>
                <Select
                  value={actionFilter}
                  onValueChange={(value) => {
                    setActionFilter(value);
                    setOffset(0);
                  }}
                >
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
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setOffset(0);
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setOffset(0);
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Organization ID</label>
                <Input
                  placeholder="Filter by organization"
                  value={organizationFilter}
                  onChange={(e) => {
                    setOrganizationFilter(e.target.value);
                    setOffset(0);
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Results per page</label>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setLimit(parseInt(value));
                    setOffset(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-md bg-destructive/10 text-destructive">{error}</div>
            )}

            {/* Audit Logs Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">Loading audit logs...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">No audit logs found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div>
                            <div className="font-medium">
                              {new Date(log.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{log.userName}</div>
                            {log.userEmail && (
                              <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                            )}
                            {log.userPhone && (
                              <div className="text-xs text-muted-foreground">{log.userPhone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_COLORS[log.action] || 'secondary'}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {log.ipAddress || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.organizationId ? (
                            <span className="font-mono text-xs">
                              {log.organizationId.slice(0, 8)}...
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.details && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} audit logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
            <DialogDescription>Detailed information about this audit log entry</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Timestamp</label>
                  <p className="text-sm font-medium">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Action</label>
                  <p className="text-sm font-medium">
                    <Badge variant={ACTION_COLORS[selectedLog.action] || 'secondary'}>
                      {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">User</label>
                  <p className="text-sm font-medium">{selectedLog.userName}</p>
                  {selectedLog.userEmail && (
                    <p className="text-xs text-muted-foreground">{selectedLog.userEmail}</p>
                  )}
                  {selectedLog.userPhone && (
                    <p className="text-xs text-muted-foreground">{selectedLog.userPhone}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">IP Address</label>
                  <p className="text-sm font-medium font-mono">{selectedLog.ipAddress || 'N/A'}</p>
                </div>
                {selectedLog.organizationId && (
                  <div>
                    <label className="text-xs text-muted-foreground">Organization ID</label>
                    <p className="text-sm font-medium font-mono">{selectedLog.organizationId}</p>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div>
                    <label className="text-xs text-muted-foreground">User Agent</label>
                    <p className="text-sm font-medium text-xs break-all">{selectedLog.userAgent}</p>
                  </div>
                )}
              </div>
              {selectedLog.details && (
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Details</label>
                  <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-96">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
