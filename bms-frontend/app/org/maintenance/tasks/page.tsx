'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Wrench, Plus, Search, Eye, Calendar, AlertCircle } from 'lucide-react';

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

export default function MaintenanceTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchTasks() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ tasks: MaintenanceTask[] }>('/api/maintenance/tasks');
        setTasks(data.tasks || []);
        setFilteredTasks(data.tasks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load maintenance tasks');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTasks();
  }, []);

  useEffect(() => {
    let filtered = tasks;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.description.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    setFilteredTasks(filtered);
  }, [searchTerm, statusFilter, tasks]);

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

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function isOverdue(nextDueDate: string): boolean {
    return new Date(nextDueDate) < new Date();
  }

  return (
    <DashboardPage
      title="Maintenance Tasks"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Maintenance', href: '/org/maintenance' },
        { label: 'Tasks', href: '/org/maintenance/tasks' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Manage preventive maintenance tasks</p>
        </div>
        <Link href="/org/maintenance/tasks/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Name</TableHead>
              <TableHead>Schedule Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auto Work Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </TableCell>
              </TableRow>
            ) : filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {tasks.length === 0
                      ? 'No maintenance tasks found. Create your first task.'
                      : 'No tasks match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task) => (
                <TableRow key={task._id}>
                  <TableCell className="font-medium">{task.taskName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.scheduleType}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.frequency
                      ? `${task.frequency.interval} ${task.frequency.unit}`
                      : task.usageThreshold
                        ? `Usage: ${task.usageThreshold}`
                        : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(task.nextDueDate)}</span>
                      {isOverdue(task.nextDueDate) && task.status !== 'completed' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.autoGenerateWorkOrder ? (
                      <Badge variant="default">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/org/maintenance/tasks/${task._id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}
