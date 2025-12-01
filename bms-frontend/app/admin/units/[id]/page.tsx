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
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { ArrowLeft, Package, Edit, Trash2 } from 'lucide-react';

interface Unit {
  _id: string;
  buildingId: string;
  unitNumber: string;
  floor?: number | null;
  unitType: string;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: string;
  rentAmount?: number | null;
}

interface Building {
  _id: string;
  name: string;
}

interface Lease {
  _id: string;
  tenantId: string;
  startDate: string;
  endDate?: string | null;
  rentAmount: number;
  status: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
}

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;
  const [unit, setUnit] = useState<Unit | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const unitData = await apiGet<{ unit: Unit }>(`/api/units/${unitId}`);
        setUnit(unitData.unit);

        // Fetch building
        const buildingData = await apiGet<{ building: Building }>(
          `/api/buildings/${unitData.unit.buildingId}`,
        );
        setBuilding(buildingData.building);

        // Fetch active lease if unit is occupied
        if (unitData.unit.status === 'occupied') {
          try {
            const leasesData = await apiGet<{ leases: Lease[] }>(
              `/api/leases?unitId=${unitId}&status=active`,
            );
            if (leasesData.leases && leasesData.leases.length > 0) {
              const activeLease = leasesData.leases[0];
              setLease(activeLease || null);

              // Fetch tenant
              if (activeLease?.tenantId) {
                const tenantData = await apiGet<{ tenant: Tenant }>(
                  `/api/tenants/${activeLease.tenantId}`,
                );
                setTenant(tenantData.tenant);
              }
            }
          } catch {
            // No active lease found
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load unit');
      } finally {
        setIsLoading(false);
      }
    }

    if (unitId) {
      fetchData();
    }
  }, [unitId]);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this unit?')) {
      return;
    }

    try {
      await apiDelete(`/api/units/${unitId}`);
      router.push(`/admin/buildings/${unit?.buildingId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading unit...</p>
        </div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Unit not found'}
        </div>
        <Link href="/admin/buildings">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Buildings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/admin/buildings/${unit.buildingId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{unit.unitNumber}</h1>
            <p className="text-muted-foreground">Unit Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unit Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Unit Number</p>
              <p className="font-medium">{unit.unitNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Building</p>
              <p className="font-medium">{building?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline">{unit.unitType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={
                  unit.status === 'occupied'
                    ? 'default'
                    : unit.status === 'available'
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {unit.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Floor</p>
              <p className="font-medium">{unit.floor ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Area</p>
              <p className="font-medium">{unit.area ? `${unit.area} m²` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bedrooms</p>
              <p className="font-medium">{unit.bedrooms ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bathrooms</p>
              <p className="font-medium">{unit.bathrooms ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Base Rent</p>
              <p className="font-medium">
                {unit.rentAmount ? `ETB ${unit.rentAmount.toLocaleString()}` : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        {lease && tenant && (
          <Card>
            <CardHeader>
              <CardTitle>Current Lease</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Tenant</p>
                <p className="font-medium">
                  {tenant.firstName} {tenant.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{tenant.primaryPhone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{new Date(lease.startDate).toLocaleDateString()}</p>
              </div>
              {lease.endDate && (
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{new Date(lease.endDate).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Rent Amount</p>
                <p className="font-medium">ETB {lease.rentAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="default">{lease.status}</Badge>
              </div>
              <Link href={`/admin/leases/${lease._id}`}>
                <Button variant="outline" className="w-full">
                  View Lease Details
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
