'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Wrench, Filter, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import type {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderCategory,
} from '@/lib/work-orders/work-orders';

interface WorkOrder {
  _id: string;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  buildingId: string;
  estimatedCost?: number | null;
  createdAt: Date | string;
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

export default function TechnicianWorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    completed: 0,
  });

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('assignedTo', 'me');
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/work-orders?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch work orders');
      }

      const data = await response.json();
      const fetchedWorkOrders = data.workOrders || [];

      setWorkOrders(fetchedWorkOrders);

      // Calculate stats
      setStats({
        total: fetchedWorkOrders.length,
        open: fetchedWorkOrders.filter(
          (wo: WorkOrder) => wo.status === 'open' || wo.status === 'assigned',
        ).length,
        inProgress: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'in_progress').length,
        completed: fetchedWorkOrders.filter((wo: WorkOrder) => wo.status === 'completed').length,
      });
    } catch (err) {
      console.error('Failed to fetch work orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-2xl font-bold">My Work Orders</div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3 animate-pulse">
              <div className="h-4 w-3/4 bg-muted rounded"></div>
              <div className="h-3 w-1/2 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Work Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Work orders assigned to you</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold">{stats.inProgress}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Open</div>
          <div className="text-2xl font-bold">{stats.open}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold">{stats.completed}</div>
        </div>
      </div>

      {/* Filter */}
      <div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as WorkOrderStatus | 'all')}
        >
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Work Orders List */}
      {workOrders.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No work orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workOrders.map((workOrder) => (
            <button
              key={workOrder._id}
              onClick={() => router.push(`/technician/work-orders/${workOrder._id}`)}
              className="w-full rounded-lg border bg-card p-4 text-left hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold mb-1 truncate">{workOrder.title}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {workOrder.description}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={STATUS_COLORS[workOrder.status]} variant="outline">
                      {workOrder.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Badge>
                    <Badge className={PRIORITY_COLORS[workOrder.priority]} variant="outline">
                      {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
                    </Badge>
                    <Badge variant="outline">{CATEGORY_LABELS[workOrder.category]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {formatDate(workOrder.createdAt)}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {workOrder.status === 'open' || workOrder.status === 'assigned' ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : workOrder.status === 'in_progress' ? (
                    <Clock className="h-5 w-5 text-purple-500" />
                  ) : workOrder.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
