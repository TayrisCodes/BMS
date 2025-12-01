'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { ArrowLeft, Building2 } from 'lucide-react';

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
}

export default function EditBuildingPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.id as string;
  const [building, setBuilding] = useState<Building | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBuilding() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ building: Building }>(`/api/buildings/${buildingId}`);
        setBuilding(data.building);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load building');
      } finally {
        setIsLoading(false);
      }
    }

    if (buildingId) {
      fetchBuilding();
    }
  }, [buildingId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!building) return;

    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const address = {
      street: formData.get('street')?.toString() || undefined,
      city: formData.get('city')?.toString() || undefined,
      region: formData.get('region')?.toString() || undefined,
      postalCode: formData.get('postalCode')?.toString() || undefined,
    };

    const updates = {
      name: formData.get('name')?.toString() || building.name,
      address: Object.values(address).some((v) => v) ? address : null,
      buildingType: formData.get('buildingType')?.toString() || building.buildingType,
      totalFloors: formData.get('totalFloors')
        ? parseInt(formData.get('totalFloors')!.toString())
        : null,
      totalUnits: formData.get('totalUnits')
        ? parseInt(formData.get('totalUnits')!.toString())
        : null,
      status: formData.get('status')?.toString() || building.status,
      managerId: formData.get('managerId')?.toString() || null,
      settings: {
        parkingSpaces: formData.get('parkingSpaces')
          ? parseInt(formData.get('parkingSpaces')!.toString())
          : undefined,
        amenities: formData.get('amenities')?.toString()
          ? formData
              .get('amenities')!
              .toString()
              .split(',')
              .map((s) => s.trim())
          : undefined,
      },
    };

    try {
      await apiPatch(`/api/buildings/${buildingId}`, updates);
      router.push(`/admin/buildings/${buildingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update building');
    } finally {
      setIsSubmitting(false);
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
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href={`/admin/buildings/${buildingId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Building
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Edit Building</CardTitle>
              <CardDescription>Update building information</CardDescription>
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
                <Label htmlFor="name">Building Name *</Label>
                <Input id="name" name="name" required defaultValue={building.name} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buildingType">Building Type *</Label>
                  <Select name="buildingType" defaultValue={building.buildingType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue={building.status} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="under-construction">Under Construction</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalFloors">Total Floors</Label>
                  <Input
                    id="totalFloors"
                    name="totalFloors"
                    type="number"
                    min="0"
                    defaultValue={building.totalFloors ?? ''}
                  />
                </div>

                <div>
                  <Label htmlFor="totalUnits">Total Units</Label>
                  <Input
                    id="totalUnits"
                    name="totalUnits"
                    type="number"
                    min="0"
                    defaultValue={building.totalUnits ?? ''}
                  />
                </div>
              </div>

              <div>
                <Label>Address</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="street" className="text-xs">
                      Street
                    </Label>
                    <Input
                      id="street"
                      name="street"
                      defaultValue={building.address?.street ?? ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city" className="text-xs">
                      City
                    </Label>
                    <Input id="city" name="city" defaultValue={building.address?.city ?? ''} />
                  </div>
                  <div>
                    <Label htmlFor="region" className="text-xs">
                      Region
                    </Label>
                    <Input
                      id="region"
                      name="region"
                      defaultValue={building.address?.region ?? ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postalCode" className="text-xs">
                      Postal Code
                    </Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      defaultValue={building.address?.postalCode ?? ''}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parkingSpaces">Parking Spaces</Label>
                  <Input
                    id="parkingSpaces"
                    name="parkingSpaces"
                    type="number"
                    min="0"
                    defaultValue={building.settings?.parkingSpaces ?? ''}
                  />
                </div>

                <div>
                  <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                  <Input
                    id="amenities"
                    name="amenities"
                    defaultValue={building.settings?.amenities?.join(', ') ?? ''}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href={`/admin/buildings/${buildingId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Building'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
