'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Textarea } from '@/lib/components/ui/textarea';
import { Label } from '@/lib/components/ui/label';
import { Input } from '@/lib/components/ui/input';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  Calendar,
  FileText,
  Image as ImageIcon,
  Wrench,
  ExternalLink,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import type {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderCategory,
} from '@/lib/work-orders/work-orders';

interface WorkOrder {
  _id: string;
  organizationId: string;
  buildingId: string;
  complaintId?: string | null;
  unitId?: string | null;
  assetId?: string | null;
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTo?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  completedAt?: Date | string | null;
  notes?: string | null;
  photos?: string[] | null;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Complaint {
  _id: string;
  title: string;
  status: string;
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

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workOrderId = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [building, setBuilding] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkOrderStatus>('open');
  const [priority, setPriority] = useState<WorkOrderPriority>('medium');
  const [notes, setNotes] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const fetchWorkOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/work-orders/${workOrderId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch work order');
      }

      const data = await response.json();
      const fetchedWorkOrder = data.workOrder as WorkOrder;
      setWorkOrder(fetchedWorkOrder);
      setStatus(fetchedWorkOrder.status);
      setPriority(fetchedWorkOrder.priority);
      setNotes(fetchedWorkOrder.notes || '');
      setActualCost(fetchedWorkOrder.actualCost?.toString() || '');
      setAssignedTo(fetchedWorkOrder.assignedTo || '');

      // Fetch building info
      if (fetchedWorkOrder.buildingId) {
        const buildingRes = await fetch(`/api/buildings/${fetchedWorkOrder.buildingId}`);
        if (buildingRes.ok) {
          const buildingData = await buildingRes.json();
          setBuilding(buildingData.building || buildingData);
        }
      }

      // Fetch linked complaint if exists
      if (fetchedWorkOrder.complaintId) {
        const complaintRes = await fetch(`/api/complaints/${fetchedWorkOrder.complaintId}`);
        if (complaintRes.ok) {
          const complaintData = await complaintRes.json();
          setComplaint(complaintData.complaint);
        }
      }
    } catch (err) {
      console.error('Failed to fetch work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to load work order');
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    fetchWorkOrder();
  }, [fetchWorkOrder]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updateData: Record<string, unknown> = {
        status,
        priority,
      };

      if (notes !== workOrder?.notes) {
        updateData.notes = notes || null;
      }

      if (actualCost && actualCost !== workOrder?.actualCost?.toString()) {
        updateData.actualCost = parseFloat(actualCost) || null;
      }

      if (assignedTo !== workOrder?.assignedTo) {
        updateData.assignedTo = assignedTo || null;
      }

      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update work order');
      }

      const data = await response.json();
      setWorkOrder(data.workOrder);
      router.refresh();
    } catch (err) {
      console.error('Failed to update work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to update work order');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          actualCost: actualCost ? parseFloat(actualCost) : null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete work order');
      }

      const data = await response.json();
      setWorkOrder(data.workOrder);
      setStatus('completed');
      router.refresh();
    } catch (err) {
      console.error('Failed to complete work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete work order');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this work order?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel work order');
      }

      router.push('/org/work-orders');
    } catch (err) {
      console.error('Failed to cancel work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel work order');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardPage
        title="Loading..."
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Work Orders', href: '/org/work-orders' },
          { label: 'Details' },
        ]}
      >
        <div className="col-span-full text-center py-8">Loading work order details...</div>
      </DashboardPage>
    );
  }

  if (error || !workOrder) {
    return (
      <DashboardPage
        title="Error"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Work Orders', href: '/org/work-orders' },
          { label: 'Details' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>{error || 'Work order not found'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/org/work-orders')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Work Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title={workOrder.title}
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Work Orders', href: '/org/work-orders' },
        { label: workOrder.title },
      ]}
    >
      {/* Header Actions */}
      <div className="col-span-full flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/org/work-orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Work Orders
        </Button>
        <div className="flex gap-2">
          {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
            <Button onClick={handleComplete} disabled={saving} variant="default">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete
            </Button>
          )}
          {workOrder.status !== 'cancelled' && (
            <Button onClick={handleCancel} disabled={saving} variant="destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="col-span-full">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Work Order Details */}
      <Card className="col-span-full md:col-span-3">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{workOrder.title}</CardTitle>
              <CardDescription className="mt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={STATUS_COLORS[workOrder.status]}>
                    {workOrder.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Badge>
                  <Badge className={PRIORITY_COLORS[workOrder.priority]}>
                    {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
                  </Badge>
                  <Badge variant="outline">{workOrder.category}</Badge>
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4" />
              Description
            </Label>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {workOrder.description}
            </p>
          </div>

          {/* Linked Complaint */}
          {complaint && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                Linked Complaint
              </Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{complaint.title}</p>
                  <p className="text-xs text-muted-foreground">Status: {complaint.status}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/org/complaints/${complaint._id}`)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </Button>
              </div>
            </div>
          )}

          {/* Photos */}
          {workOrder.photos && workOrder.photos.length > 0 && (
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4" />
                Photos ({workOrder.photos.length})
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {workOrder.photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-md overflow-hidden border"
                  >
                    <Image
                      src={photo}
                      alt={`Work order photo ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Tracking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4" />
                Estimated Cost
              </Label>
              <p className="text-lg font-medium">{formatCurrency(workOrder.estimatedCost)}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4" />
                Actual Cost
              </Label>
              <p className="text-lg font-medium">{formatCurrency(workOrder.actualCost)}</p>
              {workOrder.estimatedCost && workOrder.actualCost && (
                <p className="text-xs text-muted-foreground mt-1">
                  {workOrder.actualCost > workOrder.estimatedCost
                    ? `Over budget by ${formatCurrency(workOrder.actualCost - workOrder.estimatedCost)}`
                    : `Under budget by ${formatCurrency(workOrder.estimatedCost - workOrder.actualCost)}`}
                </p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span>{formatDate(workOrder.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Updated:</span>
              <span>{formatDate(workOrder.updatedAt)}</span>
            </div>
            {workOrder.completedAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Completed:</span>
                <span>{formatDate(workOrder.completedAt)}</span>
              </div>
            )}
            {building && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Building:</span>
                <span>{building.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Management Panel */}
      <Card className="col-span-full md:col-span-1">
        <CardHeader>
          <CardTitle>Manage Work Order</CardTitle>
          <CardDescription>Update status, priority, and details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as WorkOrderStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as WorkOrderPriority)}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assigned To Technician</Label>
            <Input
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Technician ID"
            />
            {workOrder.assignedTo && (
              <p className="text-xs text-muted-foreground">
                Currently assigned to: {workOrder.assignedTo}
              </p>
            )}
          </div>

          {/* Actual Cost */}
          <div className="space-y-2">
            <Label htmlFor="actualCost">Actual Cost (ETB)</Label>
            <Input
              id="actualCost"
              type="number"
              step="0.01"
              min="0"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this work order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Work Order ID */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Work Order ID
            </Label>
            <p className="text-sm text-muted-foreground font-mono">{workOrder._id}</p>
          </div>
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
