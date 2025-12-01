'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  User,
  MessageSquare,
} from 'lucide-react';

interface Complaint {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  photos: string[];
  assignedTo?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STEPS = [
  { value: 'open', label: 'Open', icon: Clock },
  { value: 'assigned', label: 'Assigned', icon: User },
  { value: 'in_progress', label: 'In Progress', icon: Clock },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2 },
];

export default function ComplaintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const complaintId = params.id as string;
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    async function fetchComplaint() {
      try {
        setLoading(true);
        const response = await fetch(`/api/tenant/complaints/${complaintId}`);
        if (response.ok) {
          const data = await response.json();
          setComplaint(data.complaint);
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to load complaint');
        }
      } catch (error) {
        console.error('Failed to fetch complaint:', error);
        setError('Failed to load complaint. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (complaintId) {
      fetchComplaint();
    }
  }, [complaintId]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'resolved':
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
      maintenance: 'Maintenance',
      noise: 'Noise',
      security: 'Security',
      cleanliness: 'Cleanliness',
      other: 'Other',
    };
    return categories[category] || category;
  };

  const getCurrentStatusIndex = () => {
    if (!complaint) return 0;
    return STATUS_STEPS.findIndex((step) => step.value === complaint.status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading complaint...</p>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error || 'Complaint not found'}
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
        <h1 className="text-2xl font-bold flex-1">Complaint Details</h1>
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

      {/* Complaint Details */}
      <MobileCard>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold">{complaint.title}</h2>
            <div className="flex gap-2 flex-shrink-0">
              <Badge variant={getStatusBadgeVariant(complaint.status)}>
                {complaint.status.replace('_', ' ')}
              </Badge>
              <Badge variant={getPriorityBadgeVariant(complaint.priority)}>
                {complaint.priority}
              </Badge>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Category:</span>
              <span className="font-medium">{getCategoryLabel(complaint.category)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">{new Date(complaint.createdAt).toLocaleString()}</span>
            </div>
            {complaint.resolvedAt && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Resolved:</span>
                <span className="font-medium">
                  {new Date(complaint.resolvedAt).toLocaleString()}
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
          <p className="text-muted-foreground whitespace-pre-wrap">{complaint.description}</p>
        </div>
      </MobileCard>

      {/* Photos */}
      {complaint.photos && complaint.photos.length > 0 && (
        <MobileCard>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Photos ({complaint.photos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {complaint.photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="relative aspect-square rounded-md overflow-hidden border hover:opacity-80 transition-opacity"
                >
                  <Image
                    src={photo}
                    alt={`Complaint photo ${index + 1}`}
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

      {/* Resolution Notes */}
      {complaint.resolutionNotes && (
        <MobileCard>
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Resolution Notes
            </h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{complaint.resolutionNotes}</p>
          </div>
        </MobileCard>
      )}

      {/* Photo Modal */}
      {selectedPhotoIndex !== null && complaint.photos && complaint.photos[selectedPhotoIndex] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <div className="relative w-full h-[90vh] max-w-4xl">
            <Image
              src={complaint.photos[selectedPhotoIndex]}
              alt={`Complaint photo ${selectedPhotoIndex + 1}`}
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
            {complaint.photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
                {selectedPhotoIndex + 1} / {complaint.photos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
