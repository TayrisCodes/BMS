'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, Wrench, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

interface MaintenanceTask {
  _id: string;
  organizationId: string;
  assetId: string;
  buildingId: string;
  taskName: string;
  description: string;
  scheduleType: 'time-based' | 'usage-based';
  frequency?: {
    interval: number;
    unit: 'days' | 'weeks' | 'months' | 'hours' | 'usage_cycles';
  } | null;
  usageThreshold?: number | null;
  estimatedDuration?: number | null;
  estimatedCost?: number | null;
  assignedTo?: string | null;
  lastPerformed?: string | null;
  nextDueDate: string;
  status: 'pending' | 'due' | 'overdue' | 'completed' | 'cancelled';
  autoGenerateWorkOrder: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MaintenanceTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    async function fetchTask() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ task: MaintenanceTask }>(`/api/maintenance/tasks/${taskId}`);
        setTask(data.task);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load maintenance task');
      } finally {
        setIsLoading(false);
      }
    }

    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  async function handleGenerateWorkOrder() {
    if (!task) return;

    try {
      setIsGenerating(true);
      // This would call an API endpoint to generate work order from task
      // For now, we'll use the task generator module via API
      await apiPost(`/api/maintenance/tasks/${taskId}/generate-work-order`, {});
      alert('Work order generated successfully!');
      router.push('/org/work-orders');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate work order');
    } finally {
      setIsGenerating(false);
    }
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getStatusBadgeVariant(
    status: MaintenanceTask['status'],
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'pending':
        return 'outline';
      case 'due':
        return 'default';
      case 'overdue':
        return 'destructive';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'outline';
      default:
        return 'default';
    }
  }

  function isOverdue(nextDueDate: string): boolean {
    return new Date(nextDueDate) < new Date() && task?.status !== 'completed';
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Maintenance Task"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Maintenance', href: '/org/maintenance' },
          { label: 'Tasks', href: '/org/maintenance/tasks' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full text-center py-8">
          <p className="text-muted-foreground">Loading task details...</p>
        </div>
      </DashboardPage>
    );
  }

  if (error || !task) {
    return (
      <DashboardPage
        title="Maintenance Task"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Maintenance', href: '/org/maintenance' },
          { label: 'Tasks', href: '/org/maintenance/tasks' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Task not found'}
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Maintenance Task"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Maintenance', href: '/org/maintenance' },
        { label: 'Tasks', href: '/org/maintenance/tasks' },
        { label: task.taskName, href: '#' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{task.taskName}</h1>
          <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Link href="/org/maintenance/tasks">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          {(task.status === 'due' || task.status === 'overdue') && (
            <Button onClick={handleGenerateWorkOrder} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Work Order'}
            </Button>
          )}
        </div>
      </div>

      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Description:</span>
              <p className="mt-1">{task.description}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Schedule Type:</span>
              <Badge variant="outline" className="ml-2">
                {task.scheduleType}
              </Badge>
            </div>
            {task.frequency && (
              <div>
                <span className="text-sm text-muted-foreground">Frequency:</span>
                <span className="ml-2">
                  {task.frequency.interval} {task.frequency.unit}
                </span>
              </div>
            )}
            {task.usageThreshold && (
              <div>
                <span className="text-sm text-muted-foreground">Usage Threshold:</span>
                <span className="ml-2">{task.usageThreshold}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Next Due Date:</span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatDate(task.nextDueDate)}</span>
                {isOverdue(task.nextDueDate) && (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Last Performed:</span>
              <p className="mt-1">{formatDate(task.lastPerformed)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Auto Generate Work Order:</span>
              <Badge variant={task.autoGenerateWorkOrder ? 'default' : 'outline'} className="ml-2">
                {task.autoGenerateWorkOrder ? 'Yes' : 'No'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost & Duration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Estimated Duration:</span>
              <p className="mt-1">
                {task.estimatedDuration ? `${task.estimatedDuration} minutes` : 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Estimated Cost:</span>
              <p className="mt-1">
                {task.estimatedCost
                  ? new Intl.NumberFormat('en-ET', {
                      style: 'currency',
                      currency: 'ETB',
                    }).format(task.estimatedCost)
                  : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Created:</span>
              <p className="mt-1">{formatDate(task.createdAt)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Last Updated:</span>
              <p className="mt-1">{formatDate(task.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}

