'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, Car, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
}

interface Building {
  _id: string;
  name: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  spaceType: string;
  status: string;
  buildingId: string;
}

interface Vehicle {
  _id: string;
  plateNumber: string;
  make?: string;
  model?: string;
  tenantId: string;
}

interface ParkingPricing {
  _id: string;
  buildingId: string;
  spaceType: string;
  pricingModel: string;
  monthlyRate: number | null;
}

export default function AssignTenantParkingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceIdParam = searchParams.get('spaceId');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pricing, setPricing] = useState<ParkingPricing | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0] || '');
  const [monthlyRate, setMonthlyRate] = useState<string>('');
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [tenantsData, buildingsData] = await Promise.all([
          apiGet<{ tenants: Tenant[] }>('/api/tenants').catch(() => ({ tenants: [] })),
          apiGet<{ buildings: Building[] }>('/api/buildings').catch(() => ({ buildings: [] })),
        ]);

        setTenants(tenantsData.tenants || []);
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch parking spaces when building is selected
  useEffect(() => {
    async function fetchParkingSpaces() {
      if (!selectedBuildingId) {
        setParkingSpaces([]);
        if (!spaceIdParam) {
          setSelectedSpaceId('');
        }
        return;
      }

      try {
        const response = await apiGet<{ parkingSpaces: ParkingSpace[] }>(
          `/api/parking-spaces?buildingId=${selectedBuildingId}&spaceType=tenant&status=available`,
        );
        const spaces = response.parkingSpaces || [];
        setParkingSpaces(spaces);

        // If spaceId is provided in query params, select it and set building
        if (spaceIdParam) {
          const space = spaces.find((s) => s._id === spaceIdParam);
          if (space) {
            setSelectedSpaceId(spaceIdParam);
            if (!selectedBuildingId) {
              setSelectedBuildingId(space.buildingId);
            }
          }
        } else {
          setSelectedSpaceId('');
        }
      } catch (err) {
        console.error('Failed to fetch parking spaces:', err);
        setParkingSpaces([]);
      }
    }

    fetchParkingSpaces();
  }, [selectedBuildingId, spaceIdParam]);

  // Fetch vehicles when tenant is selected
  useEffect(() => {
    async function fetchVehicles() {
      if (!selectedTenantId) {
        setVehicles([]);
        setSelectedVehicleId('');
        return;
      }

      try {
        const response = await apiGet<{ vehicles: Vehicle[] }>(
          `/api/vehicles?tenantId=${selectedTenantId}`,
        );
        setVehicles(response.vehicles || []);
        setSelectedVehicleId('');
      } catch (err) {
        console.error('Failed to fetch vehicles:', err);
        setVehicles([]);
      }
    }

    fetchVehicles();
  }, [selectedTenantId]);

  // Fetch pricing when building and space are selected
  useEffect(() => {
    async function fetchPricing() {
      if (!selectedBuildingId || !selectedSpaceId) {
        setPricing(null);
        setMonthlyRate('');
        return;
      }

      try {
        const response = await apiGet<{ parkingPricing: ParkingPricing[] }>(
          `/api/parking/pricing?buildingId=${selectedBuildingId}&spaceType=tenant&isActive=true`,
        );
        const activePricing = response.parkingPricing?.[0];
        if (activePricing && activePricing.monthlyRate) {
          setPricing(activePricing);
          setMonthlyRate(activePricing.monthlyRate.toString());
        } else {
          setPricing(null);
          setMonthlyRate('');
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
        setPricing(null);
      }
    }

    fetchPricing();
  }, [selectedBuildingId, selectedSpaceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!selectedTenantId || !selectedBuildingId || !selectedSpaceId || !monthlyRate) {
      setError('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    try {
      const assignmentData = {
        parkingSpaceId: selectedSpaceId,
        assignmentType: 'tenant' as const,
        tenantId: selectedTenantId,
        vehicleId: selectedVehicleId || null,
        startDate,
        billingPeriod: 'monthly' as const,
        rate: parseFloat(monthlyRate),
      };

      const response = await apiPost<{ message: string; parkingAssignment: { _id: string } }>(
        '/api/parking/assignments',
        assignmentData,
      );

      setSuccess('Parking assignment created successfully!');
      setTimeout(() => {
        router.push(`/org/parking/assignments/${response.parkingAssignment._id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create parking assignment');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Assign Tenant Parking"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Tenant Parking', href: '/org/parking/tenants' },
          { label: 'Assign', href: '#' },
        ]}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading form...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Assign Tenant Parking"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Tenant Parking', href: '/org/parking/tenants' },
        { label: 'Assign', href: '#' },
      ]}
    >
      <div className="col-span-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/org/parking/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Assign Tenant Parking</h2>
            <p className="text-sm text-muted-foreground">
              Assign a monthly parking space to a tenant
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantId">
                    Tenant <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId} required>
                    <SelectTrigger id="tenantId">
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant._id} value={tenant._id}>
                          {tenant.firstName} {tenant.lastName}
                          {tenant.primaryPhone && ` - ${tenant.primaryPhone}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buildingId">
                    Building <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                    <SelectTrigger id="buildingId">
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

                <div className="space-y-2">
                  <Label htmlFor="spaceId">
                    Parking Space <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedSpaceId}
                    onValueChange={setSelectedSpaceId}
                    required
                    disabled={!selectedBuildingId || parkingSpaces.length === 0}
                  >
                    <SelectTrigger id="spaceId">
                      <SelectValue placeholder="Select parking space" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingSpaces.map((space) => (
                        <SelectItem key={space._id} value={space._id}>
                          {space.spaceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBuildingId && parkingSpaces.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No available tenant parking spaces in this building
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicleId">Vehicle (Optional)</Label>
                  <Select
                    value={selectedVehicleId}
                    onValueChange={setSelectedVehicleId}
                    disabled={!selectedTenantId || vehicles.length === 0}
                  >
                    <SelectTrigger id="vehicleId">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No vehicle</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle._id} value={vehicle._id}>
                          {vehicle.plateNumber}
                          {vehicle.make && vehicle.model && ` - ${vehicle.make} ${vehicle.model}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTenantId && vehicles.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No vehicles registered for this tenant
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyRate">
                    Monthly Rate (ETB) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="monthlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  {pricing && (
                    <p className="text-xs text-muted-foreground">
                      Default rate from pricing config: {pricing.monthlyRate} ETB
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/org/parking/tenants')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Assignment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}
