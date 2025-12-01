'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { MessageSquare, AlertCircle, Clock, CheckCircle2, Filter } from 'lucide-react';
import type {
  ComplaintStatus,
  ComplaintPriority,
  ComplaintCategory,
} from '@/lib/complaints/complaints';

interface Complaint {
  _id: string;
  tenantId: string;
  unitId?: string | null;
  category: ComplaintCategory;
  title: string;
  description: string;
  photos?: string[] | null;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedTo?: string | null;
  resolvedAt?: Date | string | null;
  resolutionNotes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ComplaintStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<ComplaintPriority, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  maintenance: 'Maintenance',
  noise: 'Noise',
  security: 'Security',
  cleanliness: 'Cleanliness',
  other: 'Other',
};

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<ComplaintStats>({
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | 'all'>('all');

  const fetchComplaints = useCallback(async () => {
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

      const response = await fetch(`/api/complaints?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch complaints');
      }

      const data = await response.json();
      const fetchedComplaints = data.complaints || [];

      setComplaints(fetchedComplaints);

      // Calculate stats
      const calculatedStats: ComplaintStats = {
        total: fetchedComplaints.length,
        open: fetchedComplaints.filter((c: Complaint) => c.status === 'open').length,
        assigned: fetchedComplaints.filter((c: Complaint) => c.status === 'assigned').length,
        inProgress: fetchedComplaints.filter((c: Complaint) => c.status === 'in_progress').length,
        resolved: fetchedComplaints.filter((c: Complaint) => c.status === 'resolved').length,
        closed: fetchedComplaints.filter((c: Complaint) => c.status === 'closed').length,
      };
      setStats(calculatedStats);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
      setError(err instanceof Error ? err.message : 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (complaint: Complaint) => (
        <div className="space-y-1">
          <div className="font-medium">{complaint.title}</div>
          <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[complaint.category]}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (complaint: Complaint) => (
        <Badge className={STATUS_COLORS[complaint.status]}>
          {complaint.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (complaint: Complaint) => (
        <Badge className={PRIORITY_COLORS[complaint.priority]}>
          {complaint.priority.charAt(0).toUpperCase() + complaint.priority.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (complaint: Complaint) => (
        <div className="text-sm">
          <div>{formatDate(complaint.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{formatDateTime(complaint.createdAt)}</div>
        </div>
      ),
    },
  ];

  return (
    <DashboardPage
      title="Complaints Management"
      breadcrumbs={[{ label: 'Organization', href: '/org' }, { label: 'Complaints' }]}
    >
      {/* Statistics Cards */}
      <StatCard
        label="Total Complaints"
        value={stats.total}
        icon={MessageSquare}
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
      />
      <StatCard
        label="Open"
        value={stats.open}
        icon={AlertCircle}
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
      />
      <StatCard
        label="In Progress"
        value={stats.inProgress}
        icon={Clock}
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
      />
      <StatCard
        label="Resolved"
        value={stats.resolved + stats.closed}
        icon={CheckCircle2}
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
      />

      {/* Filters and Actions */}
      <div className="col-span-full flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ComplaintStatus | 'all')}
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
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(value) => setPriorityFilter(value as ComplaintPriority | 'all')}
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
        </div>
      </div>

      {/* Complaints Table */}
      <TableCard
        title="Complaints"
        subtitle={`${complaints.length} complaint${complaints.length !== 1 ? 's' : ''} found`}
        columns={columns as any}
        data={complaints as any}
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
        onRowClick={(complaint) => router.push(`/org/complaints/${complaint._id}`)}
        colSpan={4}
      />
    </DashboardPage>
  );
}
