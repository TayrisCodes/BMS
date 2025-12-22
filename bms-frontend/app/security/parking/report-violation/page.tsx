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
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Building {
  _id: string;
  name: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
}

export default function ReportViolationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [formData, setFormData] = useState({
    buildingId: '',
    parkingSpaceId: '',
    vehiclePlate: '',
    violationType: 'unauthorized_parking' as
      | 'unauthorized_parking'
      | 'expired_permit'
      | 'wrong_space'
      | 'overtime_parking'
      | 'no_permit',
    severity: 'warning' as 'warning' | 'fine' | 'tow',
    fineAmount: '',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        parkingSpaceId: formData.parkingSpaceId || null,
        vehicleId: null, // Would need to search by plate number
        violationType: formData.violationType,
        severity: formData.severity,
        fineAmount: formData.fineAmount ? parseFloat(formData.fineAmount) : null,
        notes: formData.notes || null,
      };

      await apiPost('/api/parking/violations', payload);
      router.push('/security/parking/violations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report violation');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SecurityMobileLayout title="Report Violation">
      <div className="space-y-4 p-4">
        <Link href="/security/parking/violations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Violation Details</CardTitle>
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
                <Label htmlFor="parkingSpaceId">Parking Space</Label>
                <Select
                  value={formData.parkingSpaceId}
                  onValueChange={(value) => setFormData({ ...formData, parkingSpaceId: value })}
                  disabled={!formData.buildingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select space (optional)" />
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
                <Label htmlFor="vehiclePlate">Vehicle Plate</Label>
                <Input
                  id="vehiclePlate"
                  value={formData.vehiclePlate}
                  onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                  placeholder="ABC-1234"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="violationType">Violation Type *</Label>
                <Select
                  value={formData.violationType}
                  onValueChange={(value: any) => setFormData({ ...formData, violationType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unauthorized_parking">Unauthorized Parking</SelectItem>
                    <SelectItem value="expired_permit">Expired Permit</SelectItem>
                    <SelectItem value="wrong_space">Wrong Space</SelectItem>
                    <SelectItem value="overtime_parking">Overtime Parking</SelectItem>
                    <SelectItem value="no_permit">No Permit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">Severity *</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: any) => setFormData({ ...formData, severity: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="fine">Fine</SelectItem>
                    <SelectItem value="tow">Tow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fineAmount">Fine Amount (ETB)</Label>
                <Input
                  id="fineAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fineAmount}
                  onChange={(e) => setFormData({ ...formData, fineAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !formData.buildingId}
              >
                {isSubmitting ? 'Reporting...' : 'Report Violation'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SecurityMobileLayout>
  );
}
