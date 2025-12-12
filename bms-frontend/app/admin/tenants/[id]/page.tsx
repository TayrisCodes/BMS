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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { apiGet } from '@/lib/utils/api-client';
import { ArrowLeft, Users, Edit } from 'lucide-react';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email?: string | null;
  nationalId?: string | null;
  language?: string | null;
  status: string;
  emergencyContact?: {
    name: string;
    phone: string;
  } | null;
  notes?: string | null;
}

interface Lease {
  _id: string;
  unitId: string;
  startDate: string;
  endDate?: string | null;
  rentAmount: number;
  status: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

interface Building {
  _id: string;
  name: string;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const tenantData = await apiGet<{ tenant: Tenant }>(`/api/tenants/${tenantId}`);
        setTenant(tenantData.tenant);

        // Fetch leases
        const leasesData = await apiGet<{ leases: Lease[] }>(`/api/leases?tenantId=${tenantId}`);
        setLeases(leasesData.leases || []);

        // Fetch units and buildings
        const unitIds = [...new Set(leasesData.leases?.map((l) => l.unitId) || [])];
        const unitMap: Record<string, Unit> = {};
        const buildingMap: Record<string, Building> = {};

        for (const unitId of unitIds) {
          try {
            const unitData = await apiGet<{ unit: Unit }>(`/api/units/${unitId}`);
            unitMap[unitId] = unitData.unit;

            if (!buildingMap[unitData.unit.buildingId]) {
              const buildingData = await apiGet<{ building: Building }>(
                `/api/buildings/${unitData.unit.buildingId}`,
              );
              buildingMap[unitData.unit.buildingId] = buildingData.building;
            }
          } catch {
            // Unit not found
          }
        }

        setUnits(unitMap);
        setBuildings(buildingMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenant');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading tenant...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Tenant not found'}
        </div>
        <Link href="/admin/tenants">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">
              {tenant.firstName} {tenant.lastName}
            </h1>
            <p className="text-muted-foreground">Tenant Details</p>
          </div>
        </div>
        <Link href={`/admin/tenants/${tenantId}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Tenant
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{tenant.primaryPhone}</p>
            </div>
            {tenant.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{tenant.email}</p>
              </div>
            )}
            {tenant.nationalId && (
              <div>
                <p className="text-sm text-muted-foreground">National ID</p>
                <p className="font-medium">{tenant.nationalId}</p>
              </div>
            )}
            {tenant.language && (
              <div>
                <p className="text-sm text-muted-foreground">Language</p>
                <Badge variant="outline">{tenant.language}</Badge>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={
                  tenant.status === 'active'
                    ? 'default'
                    : tenant.status === 'inactive'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {tenant.status}
              </Badge>
            </div>
            {tenant.emergencyContact && (
              <div>
                <p className="text-sm text-muted-foreground">Emergency Contact</p>
                <p className="font-medium">{tenant.emergencyContact.name}</p>
                <p className="text-sm text-muted-foreground">{tenant.emergencyContact.phone}</p>
              </div>
            )}
            {tenant.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{tenant.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unit & Lease History</CardTitle>
            <CardDescription>
              Complete history of units occupied by this tenant ({leases.length} lease{leases.length !== 1 ? 's' : ''})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leases.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No leases found</p>
            ) : (
              <div className="space-y-4">
                {leases
                  .sort((a, b) => {
                    // Sort by start date, newest first
                    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                  })
                  .map((lease) => {
                    const unit = units[lease.unitId];
                    const building = unit ? buildings[unit.buildingId] : null;
                    const isActive = lease.status === 'active';
                    return (
                      <div
                        key={lease._id}
                        className={`border rounded-lg p-4 space-y-2 ${
                          isActive ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/units/${lease.unitId}`}>
                                <p className="font-medium hover:text-primary cursor-pointer">
                                  {building?.name} - {unit?.unitNumber || 'N/A'}
                                </p>
                              </Link>
                              {isActive && (
                                <Badge variant="default" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              <span className="font-medium">Period:</span>{' '}
                              {new Date(lease.startDate).toLocaleDateString()} -{' '}
                              {lease.endDate
                                ? new Date(lease.endDate).toLocaleDateString()
                                : 'Ongoing (Month-to-Month)'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Rent:</span> ETB{' '}
                              {lease.rentAmount.toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant={
                              lease.status === 'active'
                                ? 'default'
                                : lease.status === 'terminated'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {lease.status}
                          </Badge>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Link href={`/admin/leases/${lease._id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              View Lease Details
                            </Button>
                          </Link>
                          <Link href={`/admin/units/${lease.unitId}`} className="flex-1">
                            <Button variant="ghost" size="sm" className="w-full">
                              View Unit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
