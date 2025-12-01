'use client';

import { useState } from 'react';
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
import { apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, Package } from 'lucide-react';

export default function NewUnitPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const unitData = {
      buildingId,
      unitNumber: formData.get('unitNumber')?.toString() || '',
      floor: formData.get('floor') ? parseInt(formData.get('floor')!.toString()) : null,
      unitType: formData.get('unitType')?.toString() || 'apartment',
      area: formData.get('area') ? parseFloat(formData.get('area')!.toString()) : null,
      bedrooms: formData.get('bedrooms') ? parseInt(formData.get('bedrooms')!.toString()) : null,
      bathrooms: formData.get('bathrooms') ? parseInt(formData.get('bathrooms')!.toString()) : null,
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

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href={`/admin/buildings/${buildingId}/units`}>
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
              <CardDescription>Add a new unit to this building</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
            )}

            <div className="space-y-4">
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
                  <Select name="unitType" defaultValue="apartment" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="shop">Shop</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="parking">Parking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" defaultValue="available" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="area">Area (m²)</Label>
                  <Input id="area" name="area" type="number" step="0.01" placeholder="e.g., 50.5" />
                </div>

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
              <Link href={`/admin/buildings/${buildingId}/units`}>
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
