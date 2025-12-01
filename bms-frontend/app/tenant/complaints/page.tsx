'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Plus, ArrowRight, Filter, Image as ImageIcon } from 'lucide-react';
import { ListItemSkeleton } from '@/lib/components/tenant/LoadingSkeleton';

interface Complaint {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  photos?: string[];
  createdAt: string;
  updatedAt?: string;
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

export default function TenantComplaintsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');

  useEffect(() => {
    async function fetchComplaints() {
      try {
        setLoading(true);
        const url = statusFilter
          ? `/api/tenant/complaints?status=${statusFilter}`
          : '/api/tenant/complaints';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setComplaints(data.complaints || data || []);
        } else {
          setComplaints([]);
        }
      } catch (error) {
        console.error('Failed to fetch complaints:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchComplaints();
  }, [statusFilter]);

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    // Update URL without page reload
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    router.push(`/tenant/complaints?${params.toString()}`, { scroll: false });
  };

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

  return (
    <div className="space-y-4 pb-20">
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
              onClick={() => handleStatusFilterChange(filter.value)}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      ) : (
        <MobileList
          items={complaints}
          loading={false}
          emptyMessage={
            statusFilter
              ? `No ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase()} complaints`
              : 'No complaints submitted yet'
          }
          renderItem={(complaint) => (
            <MobileCard
              onClick={() => router.push(`/tenant/complaints/${complaint.id}`)}
              className="border-0 border-b rounded-none cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base mb-1">{complaint.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {complaint.description}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Badge variant={getStatusBadgeVariant(complaint.status)} className="text-xs">
                      {complaint.status.replace('_', ' ')}
                    </Badge>
                    {complaint.priority && (
                      <Badge
                        variant={getPriorityBadgeVariant(complaint.priority)}
                        className="text-xs"
                      >
                        {complaint.priority}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <span>{getCategoryLabel(complaint.category)}</span>
                    <span>•</span>
                    <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                    {complaint.photos && complaint.photos.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {complaint.photos.length}
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/tenant/complaints/${complaint.id}`);
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

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-30"
        size="icon"
        onClick={() => router.push('/tenant/complaints/new')}
        aria-label="Submit complaint"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
