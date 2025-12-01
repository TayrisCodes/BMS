'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, FileText } from 'lucide-react';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
  status: string;
}

export default function NewLeasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [tenantsData, unitsData] = await Promise.all([
          apiGet<{ tenants: Tenant[] }>('/api/tenants?status=active'),
          apiGet<{ units: Unit[] }>('/api/units?status=available'),
        ]);
        setTenants(tenantsData.tenants || []);
        setUnits(unitsData.units || []);
      } catch (err) {
        console.error('Failed to fetch options', err);
      }
    }
    fetchOptions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const leaseData = {
      tenantId: selectedTenantId,
      unitId: selectedUnitId,
      startDate: formData.get('startDate')?.toString() || '',
      endDate: formData.get('endDate')?.toString() || null,
      rentAmount: parseFloat(formData.get('rentAmount')?.toString() || '0'),
      depositAmount: formData.get('depositAmount')
        ? parseFloat(formData.get('depositAmount')!.toString())
        : null,
      billingCycle: formData.get('billingCycle')?.toString() || 'monthly',
      dueDay: parseInt(formData.get('dueDay')?.toString() || '1'),
    };

    try {
      const result = await apiPost<{ lease: { _id: string } }>('/api/leases', leaseData);
      router.push(`/admin/leases/${result.lease._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lease');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/leases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leases
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Create New Lease</CardTitle>
              <CardDescription>Create a new lease agreement</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="tenantId">Tenant *</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant._id} value={tenant._id}>
                        {tenant.firstName} {tenant.lastName} - {tenant.primaryPhone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unitId">Unit *</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit._id} value={unit._id}>
                        {unit.unitNumber} ({unit.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date (optional)</Label>
                  <Input id="endDate" name="endDate" type="date" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rentAmount">Rent Amount (ETB) *</Label>
                  <Input
                    id="rentAmount"
                    name="rentAmount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g., 5000"
                  />
                </div>
                <div>
                  <Label htmlFor="depositAmount">Deposit Amount (ETB)</Label>
                  <Input
                    id="depositAmount"
                    name="depositAmount"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 10000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billingCycle">Billing Cycle *</Label>
                  <Select name="billingCycle" defaultValue="monthly" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dueDay">Due Day (1-31) *</Label>
                  <Input
                    id="dueDay"
                    name="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue="1"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/admin/leases">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Lease'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
