'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, Wrench } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
}

interface Asset {
  _id: string;
  name: string;
  buildingId: string;
}

export default function NewMaintenanceTaskPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'time-based' | 'usage-based'>('time-based');

  useEffect(() => {
    async function fetchOptions() {
      try {
        setIsLoading(true);
        const buildingsData = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchOptions();
  }, []);

  // Fetch assets when building is selected
  useEffect(() => {
    async function fetchAssets() {
      if (!selectedBuildingId) {
        setAssets([]);
        setSelectedAssetId('');
        return;
      }

      try {
        const assetsData = await apiGet<{ assets: Asset[] }>(
          `/api/assets?buildingId=${selectedBuildingId}`,
        );
        setAssets(assetsData.assets || []);
      } catch (err) {
        console.error('Failed to fetch assets', err);
        setAssets([]);
      }
    }

    fetchAssets();
  }, [selectedBuildingId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    if (!selectedBuildingId || !selectedAssetId) {
      setError('Please select both building and asset');
      setIsSubmitting(false);
      return;
    }

    const taskData: Record<string, unknown> = {
      buildingId: selectedBuildingId,
      assetId: selectedAssetId,
      taskName: formData.get('taskName')?.toString() || '',
      description: formData.get('description')?.toString() || '',
      scheduleType,
      nextDueDate: formData.get('nextDueDate')?.toString() || '',
      autoGenerateWorkOrder: formData.get('autoGenerateWorkOrder') === 'on',
    };

    if (scheduleType === 'time-based') {
      const interval = formData.get('interval')?.toString();
      const unit = formData.get('unit')?.toString();
      if (interval && unit) {
        taskData.frequency = {
          interval: parseInt(interval, 10),
          unit,
        };
      }
    } else {
      const usageThreshold = formData.get('usageThreshold')?.toString();
      if (usageThreshold) {
        taskData.usageThreshold = parseFloat(usageThreshold);
      }
    }

    const estimatedDuration = formData.get('estimatedDuration')?.toString();
    if (estimatedDuration) {
      taskData.estimatedDuration = parseInt(estimatedDuration, 10);
    }

    const estimatedCost = formData.get('estimatedCost')?.toString();
    if (estimatedCost) {
      taskData.estimatedCost = parseFloat(estimatedCost);
    }

    try {
      const response = await apiPost<{ task: { _id: string } }>('/api/maintenance/tasks', taskData);
      router.push(`/org/maintenance/tasks/${response.task._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create maintenance task');
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Create Maintenance Task"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Maintenance', href: '/org/maintenance' },
          { label: 'Tasks', href: '/org/maintenance/tasks' },
          { label: 'New', href: '#' },
        ]}
      >
        <div className="col-span-full text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Create Maintenance Task"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Maintenance', href: '/org/maintenance' },
        { label: 'Tasks', href: '/org/maintenance/tasks' },
        { label: 'New', href: '#' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Create Maintenance Task</h1>
        </div>
        <Link href="/org/maintenance/tasks">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="col-span-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Information</CardTitle>
            <CardDescription>Basic details about the maintenance task</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buildingId">
                  Building <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assetId">
                  Asset <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedAssetId}
                  onValueChange={setSelectedAssetId}
                  disabled={!selectedBuildingId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset._id} value={asset._id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taskName">
                  Task Name <span className="text-destructive">*</span>
                </Label>
                <Input id="taskName" name="taskName" required />
              </div>
              <div>
                <Label htmlFor="nextDueDate">
                  Next Due Date <span className="text-destructive">*</span>
                </Label>
                <Input id="nextDueDate" name="nextDueDate" type="date" required />
              </div>
            </div>
            <div>
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea id="description" name="description" rows={3} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="scheduleType">Schedule Type</Label>
              <Select
                value={scheduleType}
                onValueChange={(value) => setScheduleType(value as 'time-based' | 'usage-based')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time-based">Time-Based</SelectItem>
                  <SelectItem value="usage-based">Usage-Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === 'time-based' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interval">Interval</Label>
                  <Input id="interval" name="interval" type="number" min="1" required />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select name="unit" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="usageThreshold">Usage Threshold</Label>
                <Input
                  id="usageThreshold"
                  name="usageThreshold"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Maintenance will be triggered when usage reaches this threshold
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedDuration">Estimated Duration (minutes)</Label>
                <Input id="estimatedDuration" name="estimatedDuration" type="number" min="0" />
              </div>
              <div>
                <Label htmlFor="estimatedCost">Estimated Cost (ETB)</Label>
                <Input id="estimatedCost" name="estimatedCost" type="number" step="0.01" min="0" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoGenerateWorkOrder"
                name="autoGenerateWorkOrder"
                className="h-4 w-4"
              />
              <Label htmlFor="autoGenerateWorkOrder">
                Automatically generate work order when task is due
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/org/maintenance/tasks">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </DashboardPage>
  );
}

