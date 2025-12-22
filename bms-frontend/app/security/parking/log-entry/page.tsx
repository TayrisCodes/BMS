'use client';

import { useState, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';
import Link from 'next/link';

interface Building {
  _id: string;
  name: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
}

interface Vehicle {
  _id: string;
  plateNumber: string;
}

export default function LogEntryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logType, setLogType] = useState<'entry' | 'exit'>('entry');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formData, setFormData] = useState({
    buildingId: '',
    parkingSpaceId: '',
    vehicleId: '',
    notes: '',
  });

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const data = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(data.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load buildings');
      }
    }
    fetchBuildings();
  }, []);

  useEffect(() => {
    async function fetchParkingSpaces() {
      if (!formData.buildingId) {
        setParkingSpaces([]);
        return;
      }

      try {
        const data = await apiGet<{ parkingSpaces: ParkingSpace[] }>(
          `/api/parking-spaces?buildingId=${formData.buildingId}`,
        );
        setParkingSpaces(data.parkingSpaces || []);
      } catch (err) {
        console.error('Failed to fetch parking spaces', err);
      }
    }

    fetchParkingSpaces();
  }, [formData.buildingId]);

  useEffect(() => {
    async function fetchVehicles() {
      try {
        const data = await apiGet<{ vehicles: Vehicle[] }>('/api/vehicles');
        setVehicles(data.vehicles || []);
      } catch (err) {
        console.error('Failed to fetch vehicles', err);
      }
    }

    fetchVehicles();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint = logType === 'entry' ? '/api/parking/logs/entry' : '/api/parking/logs/exit';
      const payload = {
        vehicleId: formData.vehicleId,
        parkingSpaceId: formData.parkingSpaceId,
        notes: formData.notes || null,
      };

      await apiPost(endpoint, payload);
      router.push('/security/parking');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log entry/exit');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SecurityMobileLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <Link href="/security/parking">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button
              variant={logType === 'entry' ? 'default' : 'outline'}
              onClick={() => setLogType('entry')}
              size="sm"
            >
              <ArrowDown className="h-4 w-4 mr-1" />
              Entry
            </Button>
            <Button
              variant={logType === 'exit' ? 'default' : 'outline'}
              onClick={() => setLogType('exit')}
              size="sm"
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </div>
        </div>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>{logType === 'entry' ? 'Entry' : 'Exit'} Log</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="buildingId">Building *</Label>
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, buildingId: value, parkingSpaceId: '' })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
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

              <div className="space-y-2">
                <Label htmlFor="parkingSpaceId">Parking Space *</Label>
                <Select
                  value={formData.parkingSpaceId}
                  onValueChange={(value) => setFormData({ ...formData, parkingSpaceId: value })}
                  disabled={!formData.buildingId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    {parkingSpaces.map((space) => (
                      <SelectItem key={space._id} value={space._id}>
                        {space.spaceNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleId">Vehicle *</Label>
                <Select
                  value={formData.vehicleId}
                  onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle._id} value={vehicle._id}>
                        {vehicle.plateNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Logging...' : `Log ${logType === 'entry' ? 'Entry' : 'Exit'}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SecurityMobileLayout>
  );
}
