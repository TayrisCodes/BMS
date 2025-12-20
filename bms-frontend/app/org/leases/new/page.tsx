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

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  status: string;
}

export default function NewLeasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [includeParking, setIncludeParking] = useState(false);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [parkingSpaceId, setParkingSpaceId] = useState('');
  const [preferredParkingSpaceIds, setPreferredParkingSpaceIds] = useState('');
  const [autoAssignParking, setAutoAssignParking] = useState(true);

  useEffect(() => {
    async function fetchOptions() {
      try {
        setIsLoading(true);
        const [tenantsData, unitsData] = await Promise.all([
          apiGet<{ tenants: Tenant[] }>('/api/tenants?status=active'),
          apiGet<{ units: Unit[] }>('/api/units?status=available'),
        ]);
        setTenants(tenantsData.tenants || []);
        setUnits(unitsData.units || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
        console.error('Failed to fetch options', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchOptions();
  }, []);

  // Fetch available parking spaces for selected unit's building when parking is enabled
  useEffect(() => {
    async function fetchParkingSpaces() {
      if (!includeParking || !selectedUnitId) {
        setParkingSpaces([]);
        setParkingSpaceId('');
        return;
      }

      const unit = units.find((u) => u._id === selectedUnitId);
      if (!unit) {
        setParkingSpaces([]);
        setParkingSpaceId('');
        return;
      }

      try {
        const res = await apiGet<{ parkingSpaces: ParkingSpace[] }>(
          `/api/parking-spaces?buildingId=${unit.buildingId}&spaceType=tenant&status=available`,
        );
        setParkingSpaces(res.parkingSpaces || []);
        if (!parkingSpaceId && res.parkingSpaces?.length) {
          setParkingSpaceId(res.parkingSpaces[0]._id);
        }
      } catch (err) {
        console.error('Failed to fetch parking spaces for lease creation', err);
        setParkingSpaces([]);
      }
    }

    fetchParkingSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeParking, selectedUnitId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    if (!selectedTenantId || !selectedUnitId) {
      setError('Please select both tenant and unit');
      setIsSubmitting(false);
      return;
    }

    const leaseData = {
      tenantId: selectedTenantId,
      unitId: selectedUnitId,
      startDate: formData.get('startDate')?.toString() || '',
      endDate: formData.get('endDate')?.toString() || null,
      billingCycle: formData.get('billingCycle')?.toString() || 'monthly',
      dueDay: formData.get('dueDay') ? parseInt(formData.get('dueDay')!.toString(), 10) : null,
      terms: {
        rent: parseFloat(formData.get('rentAmount')?.toString() || '0'),
        serviceCharges: formData.get('serviceCharges')
          ? parseFloat(formData.get('serviceCharges')!.toString())
          : undefined,
        deposit: formData.get('depositAmount')
          ? parseFloat(formData.get('depositAmount')!.toString())
          : undefined,
        currency: 'ETB',
        vatIncluded: formData.get('vatIncluded') === 'on',
        vatRate: formData.get('vatRate')
          ? parseFloat(formData.get('vatRate')!.toString())
          : undefined,
      },
      penaltyConfig: {
        lateFeeRatePerDay: formData.get('lateFeeRatePerDay')
          ? parseFloat(formData.get('lateFeeRatePerDay')!.toString())
          : undefined,
        lateFeeGraceDays: formData.get('lateFeeGraceDays')
          ? parseInt(formData.get('lateFeeGraceDays')!.toString(), 10)
          : undefined,
        lateFeeCapDays: formData.get('lateFeeCapDays')
          ? parseInt(formData.get('lateFeeCapDays')!.toString(), 10)
          : undefined,
      },
      paymentDueDays: formData.get('paymentDueDays')
        ? parseInt(formData.get('paymentDueDays')!.toString(), 10)
        : undefined,
      renewalNoticeDays: formData.get('renewalNoticeDays')
        ? parseInt(formData.get('renewalNoticeDays')!.toString(), 10)
        : undefined,
      customTermsText: formData.get('customTermsText')?.toString() || undefined,
      includeParking,
      parkingSpaceId: parkingSpaceId || undefined,
      preferredParkingSpaceIds: preferredParkingSpaceIds
        ? preferredParkingSpaceIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      autoAssignParking,
    };

    try {
      await apiPost<{ lease: { _id: string } }>('/api/leases', leaseData);
      router.push('/org/leases');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lease');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading form...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/org/leases">
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
              <CardDescription>
                Create a new lease agreement between a tenant and unit
              </CardDescription>
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
                    {tenants.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No active tenants found
                      </div>
                    ) : (
                      tenants.map((tenant) => (
                        <SelectItem key={tenant._id} value={tenant._id}>
                          {tenant.firstName} {tenant.lastName} - {tenant.primaryPhone}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {tenants.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No active tenants available. Please create a tenant first.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="unitId">Unit *</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No available units found
                      </div>
                    ) : (
                      units.map((unit) => (
                        <SelectItem key={unit._id} value={unit._id}>
                          {unit.unitNumber} ({unit.status})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {units.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No available units found. Please ensure there are units with
                    &quot;available&quot; status.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date (optional)</Label>
                  <Input id="endDate" name="endDate" type="date" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for open-ended lease
                  </p>
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
                    min="0"
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
                    min="0"
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
                  <Label htmlFor="dueDay">Due Day (1-31)</Label>
                  <Input
                    id="dueDay"
                    name="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue="1"
                    placeholder="Day of month"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use payment due days
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serviceCharges">Service Charges (ETB)</Label>
                  <Input id="serviceCharges" name="serviceCharges" type="number" step="0.01" />
                </div>
                <div>
                  <Label htmlFor="paymentDueDays">Payment Due Days</Label>
                  <Input
                    id="paymentDueDays"
                    name="paymentDueDays"
                    type="number"
                    min="1"
                    placeholder="e.g., 7"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="vatRate">VAT Rate (%)</Label>
                  <Input id="vatRate" name="vatRate" type="number" step="0.01" defaultValue="15" />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Input id="vatIncluded" name="vatIncluded" type="checkbox" className="w-4" />
                  <Label htmlFor="vatIncluded">VAT Included in rent</Label>
                </div>
                <div>
                  <Label htmlFor="renewalNoticeDays">Renewal Notice Days</Label>
                  <Input
                    id="renewalNoticeDays"
                    name="renewalNoticeDays"
                    type="number"
                    min="0"
                    placeholder="e.g., 30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="lateFeeRatePerDay">Late Fee Rate (per day, e.g., 0.0005)</Label>
                  <Input
                    id="lateFeeRatePerDay"
                    name="lateFeeRatePerDay"
                    type="number"
                    step="0.0001"
                    defaultValue="0.0005"
                  />
                </div>
                <div>
                  <Label htmlFor="lateFeeGraceDays">Late Fee Grace Days</Label>
                  <Input
                    id="lateFeeGraceDays"
                    name="lateFeeGraceDays"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </div>
                <div>
                  <Label htmlFor="lateFeeCapDays">Late Fee Cap Days</Label>
                  <Input id="lateFeeCapDays" name="lateFeeCapDays" type="number" min="0" />
                </div>
              </div>

              <div>
                <Label htmlFor="customTermsText">Custom Terms & Conditions (optional)</Label>
                <textarea
                  id="customTermsText"
                  name="customTermsText"
                  className="mt-2 w-full rounded-md border border-input bg-background p-3 text-sm"
                  rows={4}
                  placeholder="Add lease-specific terms or penalties..."
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <input
                    id="includeParking"
                    name="includeParking"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={includeParking}
                    onChange={(e) => setIncludeParking(e.target.checked)}
                  />
                  <Label htmlFor="includeParking">Include parking assignment</Label>
                </div>
                {includeParking && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="parkingSpaceId">Select parking space (optional)</Label>
                      <Select
                        value={parkingSpaceId}
                        onValueChange={setParkingSpaceId}
                        name="parkingSpaceId"
                      >
                        <SelectTrigger id="parkingSpaceId">
                          <SelectValue placeholder="Select parking space (or leave for auto-assign)" />
                        </SelectTrigger>
                        <SelectContent>
                          {parkingSpaces.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">
                              No available parking spaces for this building
                            </div>
                          ) : (
                            parkingSpaces.map((space) => (
                              <SelectItem key={space._id} value={space._id}>
                                {space.spaceNumber} ({space.status})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="preferredParkingSpaceIds">
                        Preferred parking spaces (comma-separated IDs)
                      </Label>
                      <Input
                        id="preferredParkingSpaceIds"
                        name="preferredParkingSpaceIds"
                        value={preferredParkingSpaceIds}
                        onChange={(e) => setPreferredParkingSpaceIds(e.target.value)}
                        placeholder="e.g., id1, id2"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="autoAssignParking"
                        name="autoAssignParking"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={autoAssignParking}
                        onChange={(e) => setAutoAssignParking(e.target.checked)}
                      />
                      <Label htmlFor="autoAssignParking">Auto-assign first available space</Label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/org/leases">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting || tenants.length === 0 || units.length === 0}
              >
                {isSubmitting ? 'Creating...' : 'Create Lease'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
