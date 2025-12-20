'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Button } from '@/lib/components/ui/button';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import {
  Shield,
  UserCheck,
  Search,
  Plus,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface VisitorLog {
  _id: string;
  buildingId: string;
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  hostTenantId: string;
  hostUnitId?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  parkingSpaceId?: string | null;
  entryTime: string;
  exitTime?: string | null;
  loggedBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Building {
  _id: string;
  name: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
}

export default function SecurityManagementPage() {
  const router = useRouter();
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<VisitorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch buildings
        const buildingsData = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(buildingsData.buildings || []);

        // Fetch visitor logs
        const logsData = await apiGet<{ visitorLogs: VisitorLog[] }>('/api/visitor-logs');
        setVisitorLogs(logsData.visitorLogs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = visitorLogs;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.visitorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.visitorPhone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.visitorIdNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.purpose.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply building filter
    if (buildingFilter !== 'all') {
      filtered = filtered.filter((log) => log.buildingId === buildingFilter);
    }

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((log) => !log.exitTime);
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter((log) => log.exitTime);
    }

    // Apply date filter
    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((log) => {
        const entryDate = new Date(log.entryTime);
        return entryDate >= today;
      });
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((log) => {
        const entryDate = new Date(log.entryTime);
        return entryDate >= weekAgo;
      });
    } else if (dateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter((log) => {
        const entryDate = new Date(log.entryTime);
        return entryDate >= monthAgo;
      });
    }

    // Sort by entry time (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.entryTime).getTime();
      const dateB = new Date(b.entryTime).getTime();
      return dateB - dateA;
    });

    setFilteredLogs(filtered);
  }, [searchTerm, buildingFilter, statusFilter, dateFilter, visitorLogs]);

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusBadge(log: VisitorLog) {
    if (log.exitTime) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-green-600">
        <Clock className="h-3 w-3" />
        Active
      </Badge>
    );
  }

  const activeVisitors = visitorLogs.filter((log) => !log.exitTime).length;
  const totalVisitors = visitorLogs.length;

  return (
    <DashboardPage
      title="Security Management"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Security', href: '/org/security' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Visitor Management</h2>
              <p className="text-sm text-muted-foreground">
                Manage visitor logs, entry/exit, and security incidents
              </p>
            </div>
          </div>
          <Link href="/org/security/visitors/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log Visitor Entry
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Visitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalVisitors}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Visitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeVisitors}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently on premises</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today&apos;s Visitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  visitorLogs.filter((log) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return new Date(log.entryTime) >= today;
                  }).length
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">Entered today</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, ID, or purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings.map((building) => (
                <SelectItem key={building._id} value={building._id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Visitor Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Visitor Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading visitor logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {visitorLogs.length === 0
                    ? 'No visitor logs found. Log your first visitor entry.'
                    : 'No visitor logs match your filters.'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visitor</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Entry Time</TableHead>
                      <TableHead>Exit Time</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.visitorName}</p>
                            {log.visitorPhone && (
                              <p className="text-sm text-muted-foreground">{log.visitorPhone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">
                              Tenant {log.hostTenantId.slice(-6)}
                              {log.hostUnitId && ` - Unit ${log.hostUnitId.slice(-6)}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{log.purpose}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(log.entryTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.exitTime ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(log.exitTime)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.vehiclePlateNumber ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.vehiclePlateNumber}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(log)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/org/security/visitors/${log._id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}

