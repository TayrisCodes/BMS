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
import { ArrowLeft, Car, AlertCircle } from 'lucide-react';
import type { VehicleStatus } from '@/lib/parking/vehicles';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  buildingId: string;
}

export default function NewVehiclePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);

  // Form state
  const [tenantId, setTenantId] = useState<string>('');
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [make, setMake] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [parkingSpaceId, setParkingSpaceId] = useState<string>('__none__');
  const [status, setStatus] = useState<VehicleStatus>('active');

  useEffect(() => {
    fetchTenants();
    fetchParkingSpaces();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants?status=active');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  const fetchParkingSpaces = async () => {
    try {
      const response = await fetch('/api/parking-spaces?status=available');
      if (response.ok) {
        const data = await response.json();
        setParkingSpaces(data.parkingSpaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch parking spaces:', err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!tenantId || !plateNumber) {
        throw new Error('Tenant and plate number are required');
      }

      const vehicleData = {
        tenantId,
        plateNumber: plateNumber.trim().toUpperCase(),
        make: make.trim() || null,
        model: model.trim() || null,
        color: color.trim() || null,
        parkingSpaceId: parkingSpaceId === '__none__' ? null : parkingSpaceId,
        status,
      };

      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register vehicle');
      }

      const data = await response.json();
      router.push('/org/parking/vehicles');
    } catch (err) {
      console.error('Failed to register vehicle:', err);
      setError(err instanceof Error ? err.message : 'Failed to register vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardPage
      title="Register Vehicle"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking' },
        { label: 'Vehicles', href: '/org/parking/vehicles' },
        { label: 'New' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Car className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Register New Vehicle</CardTitle>
                <CardDescription>Register a vehicle for a tenant</CardDescription>
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

              {/* Tenant */}
              <div className="space-y-2">
                <Label htmlFor="tenantId">
                  Tenant <span className="text-destructive">*</span>
                </Label>
                <Select value={tenantId} onValueChange={setTenantId} required>
                  <SelectTrigger id="tenantId">
                    <SelectValue placeholder="Select a tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant._id} value={tenant._id}>
                        {tenant.firstName} {tenant.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Plate Number */}
              <div className="space-y-2">
                <Label htmlFor="plateNumber">
                  Plate Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="plateNumber"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC-1234"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must be unique within your organization
                </p>
              </div>

              {/* Make */}
              <div className="space-y-2">
                <Label htmlFor="make">Make (Optional)</Label>
                <Input
                  id="make"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="e.g., Toyota"
                />
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="model">Model (Optional)</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., Corolla"
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label htmlFor="color">Color (Optional)</Label>
                <Input
                  id="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g., White"
                />
              </div>

              {/* Parking Space (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="parkingSpaceId">Parking Space (Optional)</Label>
                <Select value={parkingSpaceId} onValueChange={setParkingSpaceId}>
                  <SelectTrigger id="parkingSpaceId">
                    <SelectValue placeholder="Select a parking space (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {parkingSpaces.map((space) => (
                      <SelectItem key={space._id} value={space._id}>
                        {space.spaceNumber}
                      </SelectItem>
                    ))}
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
                  onValueChange={(value) => setStatus(value as VehicleStatus)}
                  required
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
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
                  <Car className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Registering...' : 'Register Vehicle'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
