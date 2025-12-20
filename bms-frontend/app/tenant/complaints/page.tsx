'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Plus, ArrowRight, Filter, Image as ImageIcon, Wrench } from 'lucide-react';
import { ListItemSkeleton } from '@/lib/components/tenant/LoadingSkeleton';

interface Complaint {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  photos?: string[];
  type?: 'complaint' | 'maintenance_request';
  maintenanceCategory?: string | null;
  urgency?: string | null;
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

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'complaint', label: 'Complaints' },
  { value: 'maintenance_request', label: 'Maintenance Requests' },
];

const MAINTENANCE_CATEGORY_FILTERS = [
  { value: '', label: 'All Categories' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'structural', label: 'Structural' },
  { value: 'other', label: 'Other' },
];

const URGENCY_FILTERS = [
  { value: '', label: 'All Urgency' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
];

export default function TenantComplaintsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || '');
  const [maintenanceCategoryFilter, setMaintenanceCategoryFilter] = useState<string>(
    searchParams.get('maintenanceCategory') || '',
  );
  const [urgencyFilter, setUrgencyFilter] = useState<string>(searchParams.get('urgency') || '');

  useEffect(() => {
    async function fetchComplaints() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (typeFilter) params.set('type', typeFilter);
        if (maintenanceCategoryFilter) params.set('maintenanceCategory', maintenanceCategoryFilter);
        if (urgencyFilter) params.set('urgency', urgencyFilter);

        const url = params.toString()
          ? `/api/tenant/complaints?${params.toString()}`
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
  }, [statusFilter, typeFilter, maintenanceCategoryFilter, urgencyFilter]);

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    updateUrlParams('status', status);
  };

  const handleTypeFilterChange = (type: string) => {
    setTypeFilter(type);
    updateUrlParams('type', type);
    // Reset maintenance-specific filters when switching away from maintenance requests
    if (type !== 'maintenance_request') {
      setMaintenanceCategoryFilter('');
      setUrgencyFilter('');
      updateUrlParams('maintenanceCategory', '');
      updateUrlParams('urgency', '');
    }
  };

  const handleMaintenanceCategoryFilterChange = (category: string) => {
    setMaintenanceCategoryFilter(category);
    updateUrlParams('maintenanceCategory', category);
  };

  const handleUrgencyFilterChange = (urgency: string) => {
    setUrgencyFilter(urgency);
    updateUrlParams('urgency', urgency);
  };

  const updateUrlParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
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
      {/* Filters */}
      <div className="space-y-4">
        {/* Type Filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            <span>Type</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {TYPE_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={typeFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeFilterChange(filter.value)}
                className="whitespace-nowrap"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            <span>Status</span>
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

        {/* Maintenance Request Specific Filters */}
        {typeFilter === 'maintenance_request' && (
          <>
            {/* Maintenance Category Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                <span>Maintenance Category</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {MAINTENANCE_CATEGORY_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={maintenanceCategoryFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleMaintenanceCategoryFilterChange(filter.value)}
                    className="whitespace-nowrap"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Urgency Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                <span>Urgency</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {URGENCY_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={urgencyFilter === filter.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUrgencyFilterChange(filter.value)}
                    className="whitespace-nowrap"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
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
                    {complaint.type === 'maintenance_request' && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                        <Wrench className="h-3 w-3 mr-1" />
                        Maintenance
                      </Badge>
                    )}
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
                    {complaint.urgency && (
                      <Badge variant="outline" className="text-xs">
                        {complaint.urgency}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{getCategoryLabel(complaint.category)}</span>
                    {complaint.maintenanceCategory && (
                      <>
                        <span>•</span>
                        <span>{complaint.maintenanceCategory}</span>
                      </>
                    )}
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
