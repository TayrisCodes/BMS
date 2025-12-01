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
import { ArrowLeft, Building2, Edit, Package } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
  buildingType: 'residential' | 'commercial' | 'mixed';
  totalFloors?: number | null;
  totalUnits?: number | null;
  status: 'active' | 'under-construction' | 'inactive';
  managerId?: string | null;
  settings?: {
    parkingSpaces?: number;
    amenities?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  floor?: number | null;
  unitType: string;
  area?: number | null;
  status: string;
  rentAmount?: number | null;
}

export default function BuildingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.id as string;
  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [buildingData, unitsData] = await Promise.all([
          apiGet<{ building: Building }>(`/api/buildings/${buildingId}`),
          apiGet<{ units: Unit[] }>(`/api/units?buildingId=${buildingId}`).catch(() => ({
            units: [],
          })),
        ]);
        setBuilding(buildingData.building);
        setUnits(unitsData.units || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load building');
      } finally {
        setIsLoading(false);
      }
    }

    if (buildingId) {
      fetchData();
    }
  }, [buildingId]);

  function formatAddress(address: Building['address']): string {
    if (!address) return 'N/A';
    const parts = [address.street, address.city, address.region, address.postalCode].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  function getStatusBadgeVariant(
    status: Building['status'],
  ): 'default' | 'secondary' | 'destructive' {
    switch (status) {
      case 'active':
        return 'default';
      case 'under-construction':
        return 'secondary';
      case 'inactive':
        return 'destructive';
      default:
        return 'default';
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading building...</p>
        </div>
      </div>
    );
  }

  if (error || !building) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Building not found'}
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
          <Link href="/admin/buildings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{building.name}</h1>
            <p className="text-muted-foreground">Building Details</p>
          </div>
        </div>
        <Link href={`/admin/buildings/${buildingId}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Building
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{building.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline">{building.buildingType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={getStatusBadgeVariant(building.status)}>{building.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">{formatAddress(building.address)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Building Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Floors</p>
              <p className="font-medium">{building.totalFloors ?? 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="font-medium">{building.totalUnits ?? 'Not specified'}</p>
            </div>
            {building.settings?.parkingSpaces && (
              <div>
                <p className="text-sm text-muted-foreground">Parking Spaces</p>
                <p className="font-medium">{building.settings.parkingSpaces}</p>
              </div>
            )}
            {building.settings?.amenities && building.settings.amenities.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Amenities</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {building.settings.amenities.map((amenity, idx) => (
                    <Badge key={idx} variant="secondary">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Units</CardTitle>
              <CardDescription>Units in this building ({units.length})</CardDescription>
            </div>
            <Link href={`/admin/buildings/${buildingId}/units/new`}>
              <Button size="sm">
                <Package className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No units found. Add your first unit.</p>
              <Link href={`/admin/buildings/${buildingId}/units/new`}>
                <Button variant="outline" className="mt-4">
                  Add Unit
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Number</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Area (m²)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rent (ETB)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit._id}>
                    <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                    <TableCell>{unit.floor ?? 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{unit.unitType}</Badge>
                    </TableCell>
                    <TableCell>{unit.area ?? 'N/A'}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {unit.rentAmount ? `ETB ${unit.rentAmount.toLocaleString()}` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/units/${unit._id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
