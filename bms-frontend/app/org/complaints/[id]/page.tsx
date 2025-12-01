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
} from 'lucide-react';
import type { ComplaintStatus, ComplaintPriority } from '@/lib/complaints/complaints';

interface Complaint {
  _id: string;
  tenantId: string;
  unitId?: string | null;
  category: string;
  title: string;
  description: string;
  photos?: string[] | null;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedTo?: string | null;
  resolvedAt?: Date | string | null;
  resolutionNotes?: string | null;
  organizationId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
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

export default function ComplaintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const complaintId = params.id as string;

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ComplaintStatus>('open');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [linkedWorkOrder, setLinkedWorkOrder] = useState<{
    _id: string;
    title: string;
    status: string;
  } | null>(null);

  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setUserRoles(data.auth?.roles || []);
      }
    } catch (err) {
      console.error('Failed to fetch user info:', err);
    }
  }, []);

  const fetchComplaint = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/complaints/${complaintId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch complaint');
      }

      const data = await response.json();
      const fetchedComplaint = data.complaint as Complaint;
      setComplaint(fetchedComplaint);
      setStatus(fetchedComplaint.status);
      setPriority(fetchedComplaint.priority);
      setResolutionNotes(fetchedComplaint.resolutionNotes || '');

      // Check if there's a linked work order
      if (fetchedComplaint._id) {
        const workOrdersRes = await fetch(`/api/work-orders?complaintId=${fetchedComplaint._id}`);
        if (workOrdersRes.ok) {
          const workOrdersData = await workOrdersRes.json();
          if (workOrdersData.workOrders && workOrdersData.workOrders.length > 0) {
            const wo = workOrdersData.workOrders[0];
            setLinkedWorkOrder({ _id: wo._id, title: wo.title, status: wo.status });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch complaint:', err);
      setError(err instanceof Error ? err.message : 'Failed to load complaint');
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    fetchComplaint();
    fetchUserInfo();
  }, [fetchComplaint, fetchUserInfo]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          priority,
          resolutionNotes: resolutionNotes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update complaint');
      }

      const data = await response.json();
      setComplaint(data.complaint);
      router.refresh();
    } catch (err) {
      console.error('Failed to update complaint:', err);
      setError(err instanceof Error ? err.message : 'Failed to update complaint');
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

  if (loading) {
    return (
      <DashboardPage
        title="Loading..."
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Complaints', href: '/org/complaints' },
          { label: 'Details' },
        ]}
      >
        <div className="col-span-full text-center py-8">Loading complaint details...</div>
      </DashboardPage>
    );
  }

  if (error || !complaint) {
    return (
      <DashboardPage
        title="Error"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Complaints', href: '/org/complaints' },
          { label: 'Details' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>{error || 'Complaint not found'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/org/complaints')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Complaints
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title={complaint.title}
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Complaints', href: '/org/complaints' },
        { label: complaint.title },
      ]}
    >
      {/* Header Actions */}
      <div className="col-span-full flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/org/complaints')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Complaints
        </Button>
        <div className="flex gap-2">
          {(userRoles.includes('FACILITY_MANAGER') ||
            userRoles.includes('BUILDING_MANAGER') ||
            userRoles.includes('ORG_ADMIN')) &&
            !linkedWorkOrder && (
              <Button
                onClick={() => router.push(`/org/work-orders/new?complaintId=${complaintId}`)}
                variant="default"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Create Work Order
              </Button>
            )}
          {linkedWorkOrder && (
            <Button
              onClick={() => router.push(`/org/work-orders/${linkedWorkOrder._id}`)}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Work Order
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

      {/* Complaint Details */}
      <Card className="col-span-full md:col-span-3">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{complaint.title}</CardTitle>
              <CardDescription className="mt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={STATUS_COLORS[complaint.status]}>
                    {complaint.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Badge>
                  <Badge className={PRIORITY_COLORS[complaint.priority]}>
                    {complaint.priority.charAt(0).toUpperCase() + complaint.priority.slice(1)}
                  </Badge>
                  <Badge variant="outline">{complaint.category}</Badge>
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
              {complaint.description}
            </p>
          </div>

          {/* Photos */}
          {complaint.photos && complaint.photos.length > 0 && (
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4" />
                Photos ({complaint.photos.length})
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {complaint.photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-md overflow-hidden border"
                  >
                    <Image
                      src={photo}
                      alt={`Complaint photo ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span>{formatDate(complaint.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Updated:</span>
              <span>{formatDate(complaint.updatedAt)}</span>
            </div>
            {complaint.resolvedAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Resolved:</span>
                <span>{formatDate(complaint.resolvedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Management Panel */}
      <Card className="col-span-full md:col-span-1">
        <CardHeader>
          <CardTitle>Manage Complaint</CardTitle>
          <CardDescription>Update status, priority, and resolution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ComplaintStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as ComplaintPriority)}
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

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label htmlFor="resolutionNotes">Resolution Notes</Label>
            <Textarea
              id="resolutionNotes"
              placeholder="Add resolution notes..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Assigned To */}
          {complaint.assignedTo && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Assigned To
              </Label>
              <p className="text-sm text-muted-foreground">
                {complaint.assignedTo || 'Not assigned'}
              </p>
            </div>
          )}

          {/* Tenant Info */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Tenant ID
            </Label>
            <p className="text-sm text-muted-foreground font-mono">{complaint.tenantId}</p>
          </div>

          {complaint.unitId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Unit ID
              </Label>
              <p className="text-sm text-muted-foreground font-mono">{complaint.unitId}</p>
            </div>
          )}

          {/* Linked Work Order */}
          {linkedWorkOrder && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Linked Work Order
              </Label>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">{linkedWorkOrder.title}</p>
                <Badge variant="outline">{linkedWorkOrder.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/org/work-orders/${linkedWorkOrder._id}`)}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
