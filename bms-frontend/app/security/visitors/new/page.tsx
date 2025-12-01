'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, UserPlus, AlertCircle, Building, Car } from 'lucide-react';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
}

interface Building {
  _id: string;
  name: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  buildingId: string;
}

export default function NewVisitorPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [buildingId, setBuildingId] = useState<string>('');
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorPhone, setVisitorPhone] = useState<string>('');
  const [visitorIdNumber, setVisitorIdNumber] = useState<string>('');
  const [hostTenantId, setHostTenantId] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState<string>('');
  const [parkingSpaceId, setParkingSpaceId] = useState<string>('');

  useEffect(() => {
    fetchBuildings();
    fetchTenants();
  }, []);

  useEffect(() => {
    if (buildingId) {
      fetchParkingSpaces(buildingId);
    } else {
      setParkingSpaces([]);
      setParkingSpaceId('');
    }
  }, [buildingId]);

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

  const fetchParkingSpaces = async (bId: string) => {
    try {
      const response = await fetch(`/api/parking-spaces?buildingId=${bId}&status=available`);
      if (response.ok) {
        const data = await response.json();
        setParkingSpaces(data.parkingSpaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch parking spaces:', err);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tenant.firstName.toLowerCase().includes(query) ||
      tenant.lastName.toLowerCase().includes(query) ||
      tenant.primaryPhone.includes(query)
    );
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!buildingId || !visitorName || !hostTenantId || !purpose) {
        throw new Error('Building, visitor name, host tenant, and purpose are required');
      }

      const visitorData = {
        buildingId,
        visitorName: visitorName.trim(),
        visitorPhone: visitorPhone.trim() || null,
        visitorIdNumber: visitorIdNumber.trim() || null,
        hostTenantId,
        purpose: purpose.trim(),
        vehiclePlateNumber: vehiclePlateNumber.trim().toUpperCase() || null,
        parkingSpaceId: parkingSpaceId || null,
      };

      const response = await fetch('/api/visitor-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visitorData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to log visitor entry');
      }

      router.push('/security/visitors');
    } catch (err) {
      console.error('Failed to log visitor entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to log visitor entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Log Visitor Entry</h1>
        <p className="text-sm text-muted-foreground mt-1">Record a new visitor entry</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Visitor Information</CardTitle>
              <CardDescription>Enter visitor details and host information</CardDescription>
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
                <Building className="h-4 w-4 inline mr-2" />
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

            {/* Visitor Name */}
            <div className="space-y-2">
              <Label htmlFor="visitorName">
                Visitor Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="visitorName"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Enter visitor's full name"
                required
              />
            </div>

            {/* Visitor Phone */}
            <div className="space-y-2">
              <Label htmlFor="visitorPhone">Visitor Phone (Optional)</Label>
              <Input
                id="visitorPhone"
                type="tel"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                placeholder="+251911234567"
              />
            </div>

            {/* Visitor ID Number */}
            <div className="space-y-2">
              <Label htmlFor="visitorIdNumber">Visitor ID Number (Optional)</Label>
              <Input
                id="visitorIdNumber"
                value={visitorIdNumber}
                onChange={(e) => setVisitorIdNumber(e.target.value)}
                placeholder="Ethiopian ID number"
              />
            </div>

            {/* Host Tenant Search */}
            <div className="space-y-2">
              <Label htmlFor="hostTenantId">
                Host Tenant <span className="text-destructive">*</span>
              </Label>
              <Input
                id="searchTenant"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone..."
                className="mb-2"
              />
              <Select value={hostTenantId} onValueChange={setHostTenantId} required>
                <SelectTrigger id="hostTenantId">
                  <SelectValue placeholder="Select host tenant" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTenants.length === 0 ? (
                    <SelectItem value="" disabled>
                      No tenants found
                    </SelectItem>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <SelectItem key={tenant._id} value={tenant._id}>
                        {tenant.firstName} {tenant.lastName} ({tenant.primaryPhone})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label htmlFor="purpose">
                Purpose <span className="text-destructive">*</span>
              </Label>
              <Input
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g., Meeting, Delivery, Visit"
                required
              />
            </div>

            {/* Vehicle Plate Number */}
            <div className="space-y-2">
              <Label htmlFor="vehiclePlateNumber">
                <Car className="h-4 w-4 inline mr-2" />
                Vehicle Plate Number (Optional)
              </Label>
              <Input
                id="vehiclePlateNumber"
                value={vehiclePlateNumber}
                onChange={(e) => setVehiclePlateNumber(e.target.value.toUpperCase())}
                placeholder="ABC-1234"
              />
            </div>

            {/* Parking Space (if vehicle provided) */}
            {vehiclePlateNumber && buildingId && (
              <div className="space-y-2">
                <Label htmlFor="parkingSpaceId">Parking Space (Optional)</Label>
                <Select value={parkingSpaceId} onValueChange={setParkingSpaceId}>
                  <SelectTrigger id="parkingSpaceId">
                    <SelectValue placeholder="Select parking space (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {parkingSpaces.map((space) => (
                      <SelectItem key={space._id} value={space._id}>
                        {space.spaceNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                <UserPlus className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Logging...' : 'Log Entry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
