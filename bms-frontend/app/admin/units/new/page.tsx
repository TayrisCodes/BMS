'use client';

import { useEffect, useState } from 'react';
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
import { ArrowLeft, Package } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
}

interface UnitType {
  value: string;
  label: string;
}

interface Status {
  value: string;
  label: string;
}

interface Metadata {
  unitTypes: UnitType[];
  statuses: Status[];
  buildings: Building[];
  defaults: {
    unitType: string;
    status: string;
  };
}

export default function NewUnitPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string>('apartment');

  // Check if bedrooms/bathrooms should be shown (only for apartments)
  const showBedroomsBathrooms = selectedUnitType === 'apartment';

  // Update selectedUnitType when metadata loads
  useEffect(() => {
    if (metadata) {
      setSelectedUnitType(metadata.defaults.unitType);
    }
  }, [metadata]);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        setIsLoading(true);
        const data = await apiGet<Metadata>('/api/units/new');
        setMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetadata();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const buildingId = formData.get('buildingId')?.toString();
    if (!buildingId) {
      setError('Please select a building');
      setIsSubmitting(false);
      return;
    }

    const unitType = formData.get('unitType')?.toString() || 'apartment';
    const isApartment = unitType === 'apartment';

    const unitData = {
      buildingId,
      unitNumber: formData.get('unitNumber')?.toString() || '',
      floor: formData.get('floor') ? parseInt(formData.get('floor')!.toString()) : null,
      unitType,
      area: formData.get('area') ? parseFloat(formData.get('area')!.toString()) : null,
      bedrooms:
        isApartment && formData.get('bedrooms')
          ? parseInt(formData.get('bedrooms')!.toString())
          : null,
      bathrooms:
        isApartment && formData.get('bathrooms')
          ? parseFloat(formData.get('bathrooms')!.toString())
          : null,
      status: formData.get('status')?.toString() || 'available',
      rentAmount: formData.get('rentAmount')
        ? parseFloat(formData.get('rentAmount')!.toString())
        : null,
    };

    try {
      const result = await apiPost<{ unit: { _id: string } }>('/api/units', unitData);
      router.push(`/admin/units/${result.unit._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Failed to load form data'}
        </div>
        <Link href="/org/units">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Units
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/org/units">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Units
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Create New Unit</CardTitle>
              <CardDescription>Add a new unit to a building</CardDescription>
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
                <Label htmlFor="buildingId">Building *</Label>
                <Select name="buildingId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a building" />
                  </SelectTrigger>
                  <SelectContent>
                    {metadata.buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                        {building.address?.city && ` - ${building.address.city}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unitNumber">Unit Number *</Label>
                  <Input id="unitNumber" name="unitNumber" required placeholder="e.g., A-101" />
                </div>

                <div>
                  <Label htmlFor="floor">Floor</Label>
                  <Input id="floor" name="floor" type="number" placeholder="e.g., 1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unitType">Unit Type *</Label>
                  <Select
                    name="unitType"
                    defaultValue={metadata.defaults.unitType}
                    required
                    onValueChange={setSelectedUnitType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {metadata.unitTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue={metadata.defaults.status} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {metadata.statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={showBedroomsBathrooms ? 'grid grid-cols-3 gap-4' : ''}>
                <div className={showBedroomsBathrooms ? '' : 'w-full'}>
                  <Label htmlFor="area">Area (m²)</Label>
                  <Input id="area" name="area" type="number" step="0.01" placeholder="e.g., 50.5" />
                </div>

                {showBedroomsBathrooms && (
                  <>
                    <div>
                      <Label htmlFor="bedrooms">Bedrooms</Label>
                      <Input
                        id="bedrooms"
                        name="bedrooms"
                        type="number"
                        min="0"
                        placeholder="e.g., 2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="bathrooms">Bathrooms</Label>
                      <Input
                        id="bathrooms"
                        name="bathrooms"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="e.g., 1.5"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label htmlFor="rentAmount">Base Rent (ETB)</Label>
                <Input
                  id="rentAmount"
                  name="rentAmount"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/org/units">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Unit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
