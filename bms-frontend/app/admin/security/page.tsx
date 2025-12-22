'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Activity, Loader2, Shield, Users } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserRole } from '@/lib/auth/types';

interface GuardUser {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  status: string;
  lastLoginAt?: string | null;
  shiftStatus?: string | null;
}

interface VisitorLog {
  id: string;
  visitorName: string;
  visitorPhone?: string | null;
  purpose: string;
  buildingId: string;
  entryTime: string;
  exitTime?: string | null;
  vehiclePlateNumber?: string | null;
}

interface BuildingOption {
  _id: string;
  name: string;
}

export default function SecurityDashboardPage() {
  const router = useRouter();
  const [guards, setGuards] = useState<GuardUser[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSecurityRole, setIsSecurityRole] = useState(false);

  const formatDateTime = (val?: string | null) => {
    if (!val) return 'N/A';
    return new Date(val).toLocaleString();
  };

  const fetchGuards = useCallback(async () => {
    const params = new URLSearchParams({ role: 'SECURITY', limit: '100' });
    if (buildingFilter !== 'all') {
      params.append('buildingId', buildingFilter);
    }
    const res = await apiGet<{ users: any[] }>(`/api/users?${params.toString()}`);
    setGuards(
      (res.users || []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.status || 'active',
        lastLoginAt: u.lastLoginAt || null,
        shiftStatus: u.shiftStatus || null,
      })),
    );
  }, [buildingFilter]);

  const fetchVisitorLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: '20' });
    if (buildingFilter !== 'all') params.append('buildingId', buildingFilter);
    const res = await apiGet<{ logs: VisitorLog[] }>(`/api/visitor-logs?${params.toString()}`);
    setVisitorLogs(res.logs || []);
  }, [buildingFilter]);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await apiGet<{ buildings: BuildingOption[] }>('/api/buildings?status=active');
      setBuildings(res.buildings || []);
    } catch (err) {
      console.error('Failed to fetch buildings', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        const allowed =
          roles.includes('SECURITY') ||
          roles.includes('ORG_ADMIN') ||
          roles.includes('BUILDING_MANAGER');
        setIsSecurityRole(allowed);
        if (!allowed) {
          router.push('/admin/dashboard');
          return;
        }
        await fetchBuildings();
        await Promise.all([fetchGuards(), fetchVisitorLogs()]);
      } catch (err) {
        console.error('Security dashboard init failed', err);
        router.push('/admin/dashboard');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, fetchGuards, fetchVisitorLogs, fetchBuildings]);

  const filteredGuards = useMemo(() => {
    const term = search.toLowerCase();
    return guards.filter((g) => {
      if (!term) return true;
      return (
        (g.name || '').toLowerCase().includes(term) ||
        (g.email || '').toLowerCase().includes(term) ||
        (g.phone || '').toLowerCase().includes(term)
      );
    });
  }, [guards, search]);

  if (!isSecurityRole) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Security Dashboard</h1>
            <p className="text-muted-foreground">Guards, shifts, and recent visitor activity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/monitoring')}>
            <Activity className="h-4 w-4 mr-2" />
            Monitoring
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Input
              placeholder="Search guards by name, phone, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Select value={buildingFilter} onValueChange={setBuildingFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by building" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buildings</SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b._id} value={b._id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Guards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Guards</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : filteredGuards.length === 0 ? (
            <div className="text-sm text-muted-foreground">No guards found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuards.map((guard) => (
                  <TableRow key={guard.id}>
                    <TableCell className="font-medium">{guard.name || guard.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{guard.email || 'N/A'}</div>
                      <div>{guard.phone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          guard.status === 'active'
                            ? 'default'
                            : guard.status === 'inactive' || guard.status === 'suspended'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {guard.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{guard.shiftStatus || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(guard.lastLoginAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Visitor Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Visitor Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : visitorLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No visitor logs found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitorLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="font-medium">{log.visitorName}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.visitorPhone || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>{log.purpose}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.buildingId}
                    </TableCell>
                    <TableCell>{log.vehiclePlateNumber || 'N/A'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(log.entryTime)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.exitTime ? (
                        formatDateTime(log.exitTime)
                      ) : (
                        <Badge variant="outline" className="text-yellow-700">
                          Active
                        </Badge>
                      )}
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
