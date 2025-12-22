'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Activity, CheckCircle2, Loader2, Search, Users } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserRole } from '@/lib/auth/types';

interface Technician {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  status: string;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  workload: {
    open: number;
    assigned: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    active: number;
    lastWorkOrderAt?: string | null;
  };
}

export default function TechniciansDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadFilter, setLoadFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFacilityManager, setIsFacilityManager] = useState(false);

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  const fetchTechnicians = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<{ technicians: Technician[] }>('/api/technicians');
      setTechnicians(data.technicians || []);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
      setError(err instanceof Error ? err.message : 'Failed to load technicians');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function checkRole() {
      try {
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        const allowed = roles.includes('FACILITY_MANAGER') || roles.includes('ORG_ADMIN');
        setIsFacilityManager(allowed);
        if (!allowed) {
          router.push('/admin/dashboard');
          return;
        }
        await fetchTechnicians();
      } catch (err) {
        console.error('Permission check failed:', err);
        router.push('/admin/dashboard');
      }
    }
    checkRole();
  }, [router, fetchTechnicians]);

  const filteredTechnicians = useMemo(() => {
    return technicians.filter((tech) => {
      if (statusFilter !== 'all' && tech.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          (tech.name || '').toLowerCase().includes(term) ||
          (tech.email || '').toLowerCase().includes(term) ||
          (tech.phone || '').toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (loadFilter !== 'all') {
        const active = tech.workload.active;
        if (loadFilter === 'light' && active > 2) return false;
        if (loadFilter === 'medium' && (active < 3 || active > 6)) return false;
        if (loadFilter === 'heavy' && active < 6) return false;
      }
      return true;
    });
  }, [technicians, statusFilter, loadFilter, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredTechnicians.length;
    const activeWork = filteredTechnicians.reduce((sum, t) => sum + t.workload.active, 0);
    const inProgress = filteredTechnicians.reduce((sum, t) => sum + t.workload.inProgress, 0);
    return { total, activeWork, inProgress };
  }, [filteredTechnicians]);

  if (!isFacilityManager) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Technicians</h1>
            <p className="text-muted-foreground">
              Facility-level view of technicians, availability, and workload
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/technicians/board')}>
            <Activity className="h-4 w-4 mr-2" />
            Coordination Board
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Technicians</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeWork}</div>
            <p className="text-xs text-muted-foreground">Open + Assigned + In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <div className="text-3xl font-bold">{stats.inProgress}</div>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="flex flex-1 items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={loadFilter} onValueChange={setLoadFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Workload" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="light">Light (≤2 active)</SelectItem>
            <SelectItem value="medium">Medium (3-6)</SelectItem>
            <SelectItem value="heavy">Heavy (≥6)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Technician Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading technicians...
            </div>
          ) : error ? (
            <div className="text-destructive text-sm">{error}</div>
          ) : filteredTechnicians.length === 0 ? (
            <div className="text-sm text-muted-foreground">No technicians found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active Work</TableHead>
                  <TableHead>In Progress</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTechnicians.map((tech) => (
                  <TableRow key={tech.id}>
                    <TableCell className="font-medium">
                      {tech.name || tech.email || tech.phone}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{tech.email || 'N/A'}</div>
                      <div>{tech.phone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tech.status === 'active'
                            ? 'default'
                            : tech.status === 'inactive' || tech.status === 'suspended'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {tech.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tech.workload.active}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tech.workload.inProgress}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tech.workload.completed}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(tech.workload.lastWorkOrderAt || tech.lastLoginAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/admin/technicians/board?technicianId=${encodeURIComponent(tech.id)}`,
                          )
                        }
                      >
                        View Work
                      </Button>
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
