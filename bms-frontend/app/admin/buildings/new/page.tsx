'use client';

import { useState } from 'react';
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
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, Building2 } from 'lucide-react';

export default function NewBuildingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const address = {
      street: formData.get('street')?.toString() || undefined,
      city: formData.get('city')?.toString() || undefined,
      region: formData.get('region')?.toString() || undefined,
      postalCode: formData.get('postalCode')?.toString() || undefined,
    };

    const buildingData = {
      name: formData.get('name')?.toString() || '',
      address: Object.values(address).some((v) => v) ? address : null,
      buildingType: formData.get('buildingType')?.toString() || 'residential',
      totalFloors: formData.get('totalFloors')
        ? parseInt(formData.get('totalFloors')!.toString())
        : null,
      totalUnits: formData.get('totalUnits')
        ? parseInt(formData.get('totalUnits')!.toString())
        : null,
      status: formData.get('status')?.toString() || 'active',
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
      const result = await apiPost<{ building: { _id: string } }>('/api/buildings', buildingData);
      router.push(`/admin/buildings/${result.building._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create building');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/buildings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Buildings
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Create New Building</CardTitle>
              <CardDescription>Add a new building to your portfolio</CardDescription>
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
                <Input id="name" name="name" required placeholder="e.g., Sunrise Apartments" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buildingType">Building Type *</Label>
                  <Select name="buildingType" defaultValue="residential" required>
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
                  <Select name="status" defaultValue="active" required>
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
                    placeholder="e.g., 5"
                  />
                </div>

                <div>
                  <Label htmlFor="totalUnits">Total Units</Label>
                  <Input
                    id="totalUnits"
                    name="totalUnits"
                    type="number"
                    min="0"
                    placeholder="e.g., 20"
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
                    <Input id="street" name="street" placeholder="Street address" />
                  </div>
                  <div>
                    <Label htmlFor="city" className="text-xs">
                      City
                    </Label>
                    <Input id="city" name="city" placeholder="City" />
                  </div>
                  <div>
                    <Label htmlFor="region" className="text-xs">
                      Region
                    </Label>
                    <Input id="region" name="region" placeholder="Region" />
                  </div>
                  <div>
                    <Label htmlFor="postalCode" className="text-xs">
                      Postal Code
                    </Label>
                    <Input id="postalCode" name="postalCode" placeholder="Postal code" />
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
                    placeholder="e.g., 10"
                  />
                </div>

                <div>
                  <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                  <Input id="amenities" name="amenities" placeholder="e.g., Gym, Pool, Security" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/admin/buildings">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Building'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
