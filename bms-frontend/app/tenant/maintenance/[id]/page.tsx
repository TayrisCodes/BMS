'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  ArrowLeft,
  Wrench,
  CheckCircle2,
  Clock,
  User,
  DollarSign,
  Image as ImageIcon,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

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

const STATUS_STEPS = [
  { value: 'open', label: 'Open', icon: Clock },
  { value: 'assigned', label: 'Assigned', icon: User },
  { value: 'in_progress', label: 'In Progress', icon: Wrench },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
];

export default function TenantWorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workOrderId = params.id as string;
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    async function fetchWorkOrder() {
      try {
        setLoading(true);
        const response = await fetch(`/api/tenant/work-orders/${workOrderId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkOrder(data.workOrder);
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to load work order');
        }
      } catch (error) {
        console.error('Failed to fetch work order:', error);
        setError('Failed to load work order. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (workOrderId) {
      fetchWorkOrder();
    }
  }, [workOrderId]);

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

  const getCurrentStatusIndex = () => {
    if (!workOrder) return 0;
    return STATUS_STEPS.findIndex((step) => step.value === workOrder.status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading work order...</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error || 'Work order not found'}
        </div>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">Work Order Details</h1>
      </div>

      {/* Status Timeline */}
      <MobileCard>
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Status</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;

              return (
                <div key={step.value} className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div
                      className={`font-medium ${
                        isCurrent
                          ? 'text-foreground'
                          : isActive
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/60'
                      }`}
                    >
                      {step.label}
                    </div>
                    {isCurrent && index < STATUS_STEPS.length - 1 && (
                      <div className="text-sm text-muted-foreground mt-1">Current status</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </MobileCard>

      {/* Work Order Details */}
      <MobileCard>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold">{workOrder.title}</h2>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Badge variant={getStatusBadgeVariant(workOrder.status)}>
                {workOrder.status.replace('_', ' ')}
              </Badge>
              <Badge variant={getPriorityBadgeVariant(workOrder.priority)}>
                {workOrder.priority}
              </Badge>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Category:</span>
              <span className="font-medium">{getCategoryLabel(workOrder.category)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">{new Date(workOrder.createdAt).toLocaleString()}</span>
            </div>
            {workOrder.completedAt && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium">
                  {new Date(workOrder.completedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </MobileCard>

      {/* Description */}
      <MobileCard>
        <div className="space-y-2">
          <h3 className="font-semibold">Description</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">{workOrder.description}</p>
        </div>
      </MobileCard>

      {/* Cost Information */}
      {(workOrder.estimatedCost || workOrder.actualCost) && (
        <MobileCard>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Information
            </h3>
            <div className="space-y-2">
              {workOrder.estimatedCost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="font-medium">{formatCurrency(workOrder.estimatedCost)}</span>
                </div>
              )}
              {workOrder.actualCost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Cost:</span>
                  <span className="font-medium">{formatCurrency(workOrder.actualCost)}</span>
                </div>
              )}
            </div>
          </div>
        </MobileCard>
      )}

      {/* Photos */}
      {workOrder.photos && workOrder.photos.length > 0 && (
        <MobileCard>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Photos ({workOrder.photos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {workOrder.photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="relative aspect-square rounded-md overflow-hidden border hover:opacity-80 transition-opacity"
                >
                  <Image
                    src={photo}
                    alt={`Work order photo ${index + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          </div>
        </MobileCard>
      )}

      {/* Notes */}
      {workOrder.notes && (
        <MobileCard>
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Technician Notes
            </h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{workOrder.notes}</p>
          </div>
        </MobileCard>
      )}

      {/* Link to Complaint */}
      {workOrder.complaintId && (
        <MobileCard>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Related Complaint
            </h3>
            <p className="text-sm text-muted-foreground">
              This work order was created from a maintenance request.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/tenant/complaints/${workOrder.complaintId}`)}
            >
              View Complaint
              <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
            </Button>
          </div>
        </MobileCard>
      )}

      {/* Photo Modal */}
      {selectedPhotoIndex !== null && workOrder.photos && workOrder.photos[selectedPhotoIndex] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <div className="relative w-full h-[90vh] max-w-4xl">
            <Image
              src={workOrder.photos[selectedPhotoIndex]}
              alt={`Work order photo ${selectedPhotoIndex + 1}`}
              fill
              className="object-contain"
              onClick={(e) => e.stopPropagation()}
              unoptimized
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setSelectedPhotoIndex(null)}
            >
              ×
            </Button>
            {workOrder.photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
                {selectedPhotoIndex + 1} / {workOrder.photos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

