'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Textarea } from '@/lib/components/ui/textarea';
import { Label } from '@/lib/components/ui/label';
import { Input } from '@/lib/components/ui/input';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Building2,
  Calendar,
  Wrench,
  AlertCircle,
  Image as ImageIcon,
  Play,
} from 'lucide-react';
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
  actualCost?: number | null;
  completedAt?: Date | string | null;
  notes?: string | null;
  photos?: string[] | null;
  createdAt: Date | string;
  updatedAt: Date | string;
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

export default function TechnicianWorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workOrderId = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [building, setBuilding] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [actualCost, setActualCost] = useState('');

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
      setNotes(fetchedWorkOrder.notes || '');
      setActualCost(fetchedWorkOrder.actualCost?.toString() || '');

      // Fetch building info
      if (fetchedWorkOrder.buildingId) {
        const buildingRes = await fetch(`/api/buildings/${fetchedWorkOrder.buildingId}`);
        if (buildingRes.ok) {
          const buildingData = await buildingRes.json();
          setBuilding(buildingData.building || buildingData);
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

  const handleStartWork = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'in_progress',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start work');
      }

      const data = await response.json();
      setWorkOrder(data.workOrder);
      router.refresh();
    } catch (err) {
      console.error('Failed to start work:', err);
      setError(err instanceof Error ? err.message : 'Failed to start work');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNotes = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update notes');
      }

      const data = await response.json();
      setWorkOrder(data.workOrder);
    } catch (err) {
      console.error('Failed to update notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notes');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!actualCost && !confirm('No actual cost entered. Continue anyway?')) {
      return;
    }

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
      router.push('/technician/work-orders');
    } catch (err) {
      console.error('Failed to complete work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete work order');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
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
      <div className="space-y-4">
        <div className="h-8 w-3/4 bg-muted rounded animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error || 'Work order not found'}
        </div>
        <Button onClick={() => router.push('/technician/work-orders')} variant="outline">
          Back to Work Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{workOrder.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge className={STATUS_COLORS[workOrder.status]}>
            {workOrder.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </Badge>
          <Badge className={PRIORITY_COLORS[workOrder.priority]}>
            {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
          </Badge>
          <Badge variant="outline">{workOrder.category}</Badge>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{workOrder.description}</p>
        </CardContent>
      </Card>

      {/* Building Info */}
      {building && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Building
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{building.name}</p>
          </CardContent>
        </Card>
      )}

      {/* Cost Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Estimated Cost:</span>
            <span className="text-sm font-medium">{formatCurrency(workOrder.estimatedCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Actual Cost:</span>
            <span className="text-sm font-medium">{formatCurrency(workOrder.actualCost)}</span>
          </div>
          {workOrder.estimatedCost && workOrder.actualCost && (
            <div className="pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Difference:</span>
                <span
                  className={`text-sm font-medium ${
                    workOrder.actualCost > workOrder.estimatedCost
                      ? 'text-destructive'
                      : 'text-green-600'
                  }`}
                >
                  {workOrder.actualCost > workOrder.estimatedCost ? '+' : ''}
                  {formatCurrency(workOrder.actualCost - workOrder.estimatedCost)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      {workOrder.photos && workOrder.photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Photos ({workOrder.photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
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
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Start Work Button */}
            {(workOrder.status === 'open' || workOrder.status === 'assigned') && (
              <Button onClick={handleStartWork} disabled={saving} className="w-full" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Start Work
              </Button>
            )}

            {/* Actual Cost Input */}
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
                placeholder="Add notes about your work..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <Button
                onClick={handleUpdateNotes}
                disabled={saving}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Save Notes
              </Button>
            </div>

            {/* Complete Button */}
            {workOrder.status === 'in_progress' && (
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="w-full"
                size="lg"
                variant="default"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {saving ? 'Completing...' : 'Complete Work Order'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing Notes */}
      {workOrder.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{workOrder.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{formatDate(workOrder.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated:</span>
            <span>{formatDate(workOrder.updatedAt)}</span>
          </div>
          {workOrder.completedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed:</span>
              <span>{formatDate(workOrder.completedAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
