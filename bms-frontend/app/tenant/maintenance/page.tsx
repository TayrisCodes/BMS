'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { ArrowRight, Wrench, Filter, Clock, User } from 'lucide-react';
import { ListItemSkeleton } from '@/lib/components/tenant/LoadingSkeleton';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  completedAt?: string | null;
  notes?: string | null;
  photos?: string[];
  complaintId?: string | null;
  unitId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function TenantMaintenancePage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    async function fetchWorkOrders() {
      try {
        setLoading(true);
        const url = statusFilter
          ? `/api/tenant/work-orders?status=${statusFilter}`
          : '/api/tenant/work-orders';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setWorkOrders(data.workOrders || []);
        } else {
          setWorkOrders([]);
        }
      } catch (error) {
        console.error('Failed to fetch work orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkOrders();
  }, [statusFilter]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'assigned':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
      plumbing: 'Plumbing',
      electrical: 'Electrical',
      hvac: 'HVAC',
      cleaning: 'Cleaning',
      security: 'Security',
      other: 'Other',
    };
    return categories[category] || category;
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold mb-2">Maintenance Work Orders</h1>
        <p className="text-muted-foreground">
          Track maintenance work orders linked to your complaints and unit.
        </p>
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" />
          <span>Filter by Status</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Work Orders List */}
      {loading ? (
        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      ) : (
        <MobileList
          items={workOrders}
          loading={false}
          emptyMessage={
            statusFilter
              ? `No ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase()} work orders`
              : 'No work orders found'
          }
          renderItem={(workOrder) => (
            <MobileCard
              onClick={() => router.push(`/tenant/maintenance/${workOrder.id}`)}
              className="border-0 border-b rounded-none cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base mb-1 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      {workOrder.title}
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {workOrder.description}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Badge variant={getStatusBadgeVariant(workOrder.status)} className="text-xs">
                      {workOrder.status.replace('_', ' ')}
                    </Badge>
                    <Badge
                      variant={getPriorityBadgeVariant(workOrder.priority)}
                      className="text-xs"
                    >
                      {workOrder.priority}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <span>{getCategoryLabel(workOrder.category)}</span>
                    <span>•</span>
                    <span>{new Date(workOrder.createdAt).toLocaleDateString()}</span>
                    {workOrder.assignedTo && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Assigned
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/tenant/maintenance/${workOrder.id}`);
                    }}
                  >
                    View
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </MobileCard>
          )}
        />
      )}
    </div>
  );
}
