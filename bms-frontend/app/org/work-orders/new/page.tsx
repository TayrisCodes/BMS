'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { ArrowLeft, Wrench, Building2, AlertCircle } from 'lucide-react';
import type { WorkOrderCategory, WorkOrderPriority } from '@/lib/work-orders/work-orders';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

interface Complaint {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  buildingId?: string;
  unitId?: string;
}

export default function NewWorkOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const complaintId = searchParams.get('complaintId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [buildingId, setBuildingId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<WorkOrderCategory>('other');
  const [priority, setPriority] = useState<WorkOrderPriority>('medium');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');

  const fetchComplaint = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/complaints/${complaintId}`);
      if (response.ok) {
        const data = await response.json();
        setComplaint(data.complaint);
      }
    } catch (err) {
      console.error('Failed to fetch complaint:', err);
      setError('Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    fetchBuildings();
    if (complaintId) {
      fetchComplaint();
    } else {
      setLoading(false);
    }
  }, [complaintId, fetchComplaint]);

  useEffect(() => {
    if (buildingId) {
      fetchUnits(buildingId);
    } else {
      setUnits([]);
    }
  }, [buildingId]);

  useEffect(() => {
    if (complaint) {
      // Pre-fill form with complaint data
      setTitle(complaint.title || '');
      setDescription(complaint.description || '');
      setCategory((complaint.category as WorkOrderCategory) || 'other');
      setPriority((complaint.priority as WorkOrderPriority) || 'medium');
      if (complaint.buildingId) {
        setBuildingId(complaint.buildingId);
      }
      if (complaint.unitId) {
        setUnitId(complaint.unitId);
      }
    }
  }, [complaint]);

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/buildings?status=active');
      if (response.ok) {
        const data = await response.json();
        setBuildings(data.buildings || []);
      }
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  const fetchUnits = async (bId: string) => {
    try {
      const response = await fetch(`/api/units?buildingId=${bId}&status=available`);
      if (response.ok) {
        const data = await response.json();
        setUnits(data.units || []);
      }
    } catch (err) {
      console.error('Failed to fetch units:', err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const workOrderData = {
        buildingId,
        complaintId: complaintId || null,
        unitId: unitId || null,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        assignedTo: assignedTo || null,
      };

      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workOrderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create work order');
      }

      const data = await response.json();

      // Update complaint status to "assigned" if created from complaint
      if (complaintId) {
        try {
          await fetch(`/api/complaints/${complaintId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'assigned' }),
          });
        } catch (err) {
          console.error('Failed to update complaint status:', err);
        }
      }

      router.push(`/org/work-orders/${data.workOrder._id}`);
    } catch (err) {
      console.error('Failed to create work order:', err);
      setError(err instanceof Error ? err.message : 'Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardPage
        title="Create Work Order"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Work Orders', href: '/org/work-orders' },
          { label: 'New' },
        ]}
      >
        <div className="col-span-full text-center py-8">Loading...</div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Create Work Order"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Work Orders', href: '/org/work-orders' },
        { label: 'New' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Create New Work Order</CardTitle>
                <CardDescription>
                  {complaintId
                    ? 'Create a work order from this complaint'
                    : 'Create a new work order for maintenance or repair'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              )}

              {complaintId && complaint && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Creating work order from complaint:
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{complaint.title}</p>
                </div>
              )}

              {/* Building */}
              <div className="space-y-2">
                <Label htmlFor="buildingId">
                  Building <span className="text-destructive">*</span>
                </Label>
                <Select value={buildingId} onValueChange={setBuildingId} required>
                  <SelectTrigger id="buildingId">
                    <SelectValue placeholder="Select a building" />
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

              {/* Unit (Optional) */}
              {buildingId && (
                <div className="space-y-2">
                  <Label htmlFor="unitId">Unit (Optional)</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger id="unitId">
                      <SelectValue placeholder="Select a unit (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit._id} value={unit._id}>
                          {unit.unitNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Fix Broken AC Unit"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work that needs to be done..."
                  rows={5}
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as WorkOrderCategory)}
                  required
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">
                  Priority <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as WorkOrderPriority)}
                  required
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

              {/* Estimated Cost */}
              <div className="space-y-2">
                <Label htmlFor="estimatedCost">Estimated Cost (ETB)</Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Assigned To (Optional - can be assigned later) */}
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign To Technician (Optional)</Label>
                <Input
                  id="assignedTo"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Technician ID (can be assigned later)"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to create as unassigned. You can assign later.
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Wrench className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating...' : 'Create Work Order'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
