'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { AlertCircle, Clock, Loader2, Shuffle, Users, Wrench } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserRole } from '@/lib/auth/types';
import type {
  WorkOrderCategory,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/lib/work-orders/work-orders';

interface TechnicianOption {
  id: string;
  name: string;
}

interface WorkOrder {
  _id: string;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  buildingId: string;
  assignedTo?: string | null;
  createdAt: string | Date;
}

interface BuildingOption {
  _id: string;
  name: string;
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_COLORS: Record<WorkOrderPriority, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_GROUPS: WorkOrderStatus[] = ['open', 'assigned', 'in_progress'];

export default function TechnicianBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'active'>('active');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>(
    searchParams.get('technicianId') || 'all',
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignTechId, setAssignTechId] = useState<string>('none');
  const [assignStatus, setAssignStatus] = useState<WorkOrderStatus>('assigned');
  const [isFacilityManager, setIsFacilityManager] = useState(false);

  const fetchTechnicians = useCallback(async () => {
    const data = await apiGet<{
      technicians: Array<{ id: string; name?: string | null; phone: string }>;
    }>('/api/technicians');
    setTechnicians(
      data.technicians.map((t) => ({
        id: t.id,
        name: t.name || t.phone,
      })),
    );
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await apiGet<{ buildings: BuildingOption[] }>('/api/buildings?status=active');
      setBuildings(res.buildings || []);
    } catch (err) {
      console.error('Failed to fetch buildings', err);
    }
  }, []);

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (buildingFilter !== 'all') params.append('buildingId', buildingFilter);
      if (technicianFilter !== 'all') params.append('assignedTo', technicianFilter);
      if (statusFilter !== 'active') params.append('status', statusFilter);
      else params.append('status', 'open'); // include open by default, we will add others below

      const data = await apiGet<{ workOrders: WorkOrder[] }>(
        `/api/work-orders?${params.toString()}`,
      );

      // If statusFilter is active, pull additional statuses
      let items = data.workOrders || [];
      if (statusFilter === 'active') {
        const params2 = new URLSearchParams(params);
        params2.set('status', 'assigned');
        const dataAssigned = await apiGet<{ workOrders: WorkOrder[] }>(
          `/api/work-orders?${params2.toString()}`,
        );
        const params3 = new URLSearchParams(params);
        params3.set('status', 'in_progress');
        const dataInProg = await apiGet<{ workOrders: WorkOrder[] }>(
          `/api/work-orders?${params3.toString()}`,
        );
        items = [...items, ...(dataAssigned.workOrders || []), ...(dataInProg.workOrders || [])];
      }

      setWorkOrders(items);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to fetch work orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [buildingFilter, technicianFilter, statusFilter]);

  useEffect(() => {
    async function init() {
      try {
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        const allowed = roles.includes('FACILITY_MANAGER') || roles.includes('ORG_ADMIN');
        setIsFacilityManager(allowed);
        if (!allowed) {
          router.push('/admin/dashboard');
          return;
        }
        await Promise.all([fetchTechnicians(), fetchBuildings()]);
        await fetchWorkOrders();
      } catch (err) {
        console.error('Init failed', err);
        router.push('/admin/dashboard');
      }
    }
    init();
  }, [router, fetchTechnicians, fetchBuildings, fetchWorkOrders]);

  const technicianName = useCallback(
    (id?: string | null) => technicians.find((t) => t.id === id)?.name || 'Unassigned',
    [technicians],
  );

  const buildingName = useCallback(
    (id?: string) => buildings.find((b) => b._id === id)?.name || 'Building',
    [buildings],
  );

  const grouped = useMemo(() => {
    const map: Record<WorkOrderStatus, WorkOrder[]> = {
      open: [],
      assigned: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    };
    workOrders.forEach((wo) => {
      map[wo.status]?.push(wo);
    });
    return map;
  }, [workOrders]);

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const bulkAssign = async (toTech: string | null, status?: WorkOrderStatus) => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await fetch(`/api/work-orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignedTo: toTech,
            status: status ?? undefined,
          }),
        });
      }
      await fetchWorkOrders();
    } catch (err) {
      console.error('Bulk assign failed', err);
      setError('Failed to update assignments');
    } finally {
      setLoading(false);
    }
  };

  if (!isFacilityManager) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Technician Coordination</h1>
            <p className="text-muted-foreground">
              Assign and balance work orders across technicians
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => router.push('/admin/technicians')}>
          Back to Directory
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={technicianFilter} onValueChange={(v) => setTechnicianFilter(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={buildingFilter} onValueChange={(v) => setBuildingFilter(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Building" />
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

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active (Open/Assigned/In Progress)</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchWorkOrders} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={assignTechId} onValueChange={setAssignTechId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Assign to..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assignStatus} onValueChange={(v) => setAssignStatus(v as WorkOrderStatus)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => bulkAssign(assignTechId === 'none' ? null : assignTechId, assignStatus)}
            disabled={selectedIds.size === 0 || loading}
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Apply to {selectedIds.size} selected
          </Button>
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {/* Board */}
      <div className="grid gap-4 md:grid-cols-3">
        {STATUS_GROUPS.map((status) => (
          <Card key={status}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {status === 'open' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                {status === 'assigned' && <Users className="h-4 w-4 text-blue-500" />}
                {status === 'in_progress' && <Clock className="h-4 w-4 text-purple-500" />}
                {STATUS_LABELS[status]}
              </CardTitle>
              <Badge variant="outline">{grouped[status]?.length || 0}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : grouped[status]?.length === 0 ? (
                <div className="text-sm text-muted-foreground">No work orders</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={
                            grouped[status].length > 0 &&
                            grouped[status].every((wo) => selectedIds.has(wo._id))
                          }
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) {
                              grouped[status].forEach((wo) => next.add(wo._id));
                            } else {
                              grouped[status].forEach((wo) => next.delete(wo._id));
                            }
                            setSelectedIds(next);
                          }}
                        />
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Building</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped[status].map((wo) => (
                      <TableRow key={wo._id} className="align-top">
                        <TableCell className="pt-3">
                          <Input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selectedIds.has(wo._id)}
                            onChange={(e) => toggleSelect(wo._id, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{wo.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {wo.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{technicianName(wo.assignedTo)}</TableCell>
                        <TableCell>
                          <Badge className={PRIORITY_COLORS[wo.priority]} variant="outline">
                            {wo.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {buildingName(wo.buildingId)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

