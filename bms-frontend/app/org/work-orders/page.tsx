'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import type { Column } from '@/lib/components/dashboard/cards/TableCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Wrench, Plus, Filter, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderCategory,
} from '@/lib/work-orders/work-orders';

interface WorkOrder extends Record<string, unknown> {
  _id: string;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTo?: string | null;
  buildingId: string;
  estimatedCost?: number | null;
  actualCost?: number | null;
  createdAt: Date | string;
}

interface WorkOrderStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<WorkOrderPriority, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  cleaning: 'Cleaning',
  security: 'Security',
  other: 'Other',
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats>({
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<WorkOrderCategory | 'all'>('all');
  const [buildings, setBuildings] = useState<{ _id: string; name: string }[]>([]);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');

  const fetchBuildings = useCallback(async () => {
    try {
      const response = await fetch('/api/buildings?status=active');
      if (response.ok) {
        const data = await response.json();
        setBuildings(data.buildings || []);
      }
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  }, []);

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (buildingFilter !== 'all') {
        params.append('buildingId', buildingFilter);
      }

      const response = await fetch(`/api/work-orders?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch work orders');
      }

      const data = await response.json();
      const fetchedWorkOrders = data.workOrders || [];

      setWorkOrders(fetchedWorkOrders);

      // Calculate stats
      const calculatedStats: WorkOrderStats = {
        total: fetchedWorkOrders.length,
        open: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'open').length,
        assigned: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'assigned').length,
        inProgress: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'in_progress').length,
        completed: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'completed').length,
        cancelled: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'cancelled').length,
      };
      setStats(calculatedStats);
    } catch (err) {
      console.error('Failed to fetch work orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, buildingFilter]);

  useEffect(() => {
    fetchWorkOrders();
    fetchBuildings();
  }, [fetchWorkOrders, fetchBuildings]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const columns: Column<WorkOrder>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (workOrder: WorkOrder) => (
        <div className="space-y-1">
          <div className="font-medium">{workOrder.title}</div>
          <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[workOrder.category]}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (workOrder: WorkOrder) => (
        <Badge className={STATUS_COLORS[workOrder.status]}>
          {workOrder.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (workOrder: WorkOrder) => (
        <Badge className={PRIORITY_COLORS[workOrder.priority]}>
          {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'estimatedCost',
      label: 'Estimated Cost',
      render: (workOrder: WorkOrder) => (
        <span className="text-sm">{formatCurrency(workOrder.estimatedCost)}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (workOrder: WorkOrder) => (
        <div className="text-sm">{formatDate(workOrder.createdAt)}</div>
      ),
    },
  ];

  return (
    <DashboardPage
      title="Work Orders"
      breadcrumbs={[{ label: 'Organization', href: '/org' }, { label: 'Work Orders' }]}
    >
      {/* Statistics Cards */}
      <StatCard
        label="Total Work Orders"
        value={stats.total}
        icon={Wrench}
        loading={loading}
        error={error}
        onRetry={fetchWorkOrders}
      />
      <StatCard
        label="Open"
        value={stats.open}
        icon={AlertCircle}
        loading={loading}
        error={error}
        onRetry={fetchWorkOrders}
      />
      <StatCard
        label="In Progress"
        value={stats.inProgress}
        icon={Clock}
        loading={loading}
        error={error}
        onRetry={fetchWorkOrders}
      />
      <StatCard
        label="Completed"
        value={stats.completed}
        icon={CheckCircle2}
        loading={loading}
        error={error}
        onRetry={fetchWorkOrders}
      />

      {/* Filters and Actions */}
      <div className="col-span-full flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as WorkOrderStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(value) => setPriorityFilter(value as WorkOrderPriority | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value as WorkOrderCategory | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="plumbing">Plumbing</SelectItem>
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="hvac">HVAC</SelectItem>
              <SelectItem value="cleaning">Cleaning</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by building" />
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
        </div>

        <Button onClick={() => router.push('/org/work-orders/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>

      {/* Work Orders Table */}
      <TableCard<WorkOrder>
        title="Work Orders"
        subtitle={`${workOrders.length} work order${workOrders.length !== 1 ? 's' : ''} found`}
        columns={columns}
        data={workOrders}
        loading={loading}
        error={error}
        onRetry={fetchWorkOrders}
        onRowClick={(workOrder) => router.push(`/org/work-orders/${workOrder._id}`)}
        colSpan={4}
      />
    </DashboardPage>
  );
}
