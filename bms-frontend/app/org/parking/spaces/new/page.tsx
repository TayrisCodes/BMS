'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
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
import { ArrowLeft, ParkingSquare, AlertCircle } from 'lucide-react';
import type { ParkingSpaceType, ParkingSpaceStatus } from '@/lib/parking/parking-spaces';

interface Building {
  _id: string;
  name: string;
}

export default function NewParkingSpacePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);

  // Form state
  const [buildingId, setBuildingId] = useState<string>('');
  const [spaceNumber, setSpaceNumber] = useState<string>('');
  const [spaceType, setSpaceType] = useState<ParkingSpaceType>('tenant');
  const [status, setStatus] = useState<ParkingSpaceStatus>('available');

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/buildings?status=active');
      if (response.ok) {
        const data = await response.json();
        setBuildings(data.buildings || []);
      }
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!buildingId || !spaceNumber) {
        throw new Error('Building and space number are required');
      }

      const spaceData = {
        buildingId,
        spaceNumber: spaceNumber.trim(),
        spaceType,
        status,
      };

      const response = await fetch('/api/parking-spaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(spaceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create parking space');
      }

      const data = await response.json();
      router.push('/org/parking/spaces');
    } catch (err) {
      console.error('Failed to create parking space:', err);
      setError(err instanceof Error ? err.message : 'Failed to create parking space');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardPage
      title="Add Parking Space"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking' },
        { label: 'Spaces', href: '/org/parking/spaces' },
        { label: 'New' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ParkingSquare className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Add New Parking Space</CardTitle>
                <CardDescription>Create a new parking space for a building</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Building */}
              <div className="space-y-2">
                <Label htmlFor="buildingId">
                  Building <span className="text-destructive">*</span>
                </Label>
                <Select value={buildingId} onValueChange={setBuildingId} required>
                  <SelectTrigger id="buildingId">
                    <SelectValue placeholder="Select a building" />
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

              {/* Space Number */}
              <div className="space-y-2">
                <Label htmlFor="spaceNumber">
                  Space Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="spaceNumber"
                  value={spaceNumber}
                  onChange={(e) => setSpaceNumber(e.target.value)}
                  placeholder="e.g., P-001, V-001"
                  required
                />
                <p className="text-xs text-muted-foreground">Must be unique within the building</p>
              </div>

              {/* Space Type */}
              <div className="space-y-2">
                <Label htmlFor="spaceType">
                  Space Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={spaceType}
                  onValueChange={(value) => setSpaceType(value as ParkingSpaceType)}
                  required
                >
                  <SelectTrigger id="spaceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="visitor">Visitor</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as ParkingSpaceStatus)}
                  required
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <ParkingSquare className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating...' : 'Create Parking Space'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
