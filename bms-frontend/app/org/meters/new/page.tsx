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
import { ArrowLeft, Gauge, AlertCircle } from 'lucide-react';
import type { MeterType, MeterStatus, MeterUnit } from '@/lib/meters/meters';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

export default function NewMeterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Form state
  const [buildingId, setBuildingId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [meterNumber, setMeterNumber] = useState<string>('');
  const [meterType, setMeterType] = useState<MeterType>('electricity');
  const [unit, setUnit] = useState<MeterUnit>('kwh');
  const [installationDate, setInstallationDate] = useState<string>('');
  const [status, setStatus] = useState<MeterStatus>('active');

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (buildingId) {
      fetchUnits(buildingId);
    } else {
      setUnits([]);
      setUnitId('');
    }
  }, [buildingId]);

  useEffect(() => {
    // Auto-set unit based on meter type
    if (meterType === 'electricity') {
      setUnit('kwh');
    } else if (meterType === 'water' || meterType === 'gas') {
      setUnit('cubic_meter');
    }
  }, [meterType]);

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

  const fetchUnits = async (bId: string) => {
    try {
      const response = await fetch(`/api/units?buildingId=${bId}`);
      if (response.ok) {
        const data = await response.json();
        setUnits(data.units || []);
      }
    } catch (err) {
      console.error('Failed to fetch units:', err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!buildingId || !meterNumber || !installationDate) {
        throw new Error('Building, meter number, and installation date are required');
      }

      const meterData = {
        buildingId,
        unitId: unitId || null,
        assetId: null, // Asset selection not implemented yet
        meterType,
        meterNumber: meterNumber.trim(),
        unit,
        installationDate: new Date(installationDate).toISOString(),
        status,
      };

      const response = await fetch('/api/meters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(meterData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create meter');
      }

      const data = await response.json();
      router.push(`/org/meters/${data.meter._id}`);
    } catch (err) {
      console.error('Failed to create meter:', err);
      setError(err instanceof Error ? err.message : 'Failed to create meter');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for default installation date
  const today = new Date().toISOString().split('T')[0];

  return (
    <DashboardPage
      title="Register Meter"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Meters', href: '/org/meters' },
        { label: 'New' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Gauge className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Register New Meter</CardTitle>
                <CardDescription>
                  Register a new utility meter (electricity, water, or gas)
                </CardDescription>
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

              {/* Unit (Optional) */}
              {buildingId && (
                <div className="space-y-2">
                  <Label htmlFor="unitId">Unit (Optional)</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger id="unitId">
                      <SelectValue placeholder="Select a unit (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (Building-level meter)</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit._id} value={unit._id}>
                          {unit.unitNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty for building-level meters
                  </p>
                </div>
              )}

              {/* Meter Type */}
              <div className="space-y-2">
                <Label htmlFor="meterType">
                  Meter Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={meterType}
                  onValueChange={(value) => setMeterType(value as MeterType)}
                  required
                >
                  <SelectTrigger id="meterType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electricity">Electricity</SelectItem>
                    <SelectItem value="water">Water</SelectItem>
                    <SelectItem value="gas">Gas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Meter Number */}
              <div className="space-y-2">
                <Label htmlFor="meterNumber">
                  Meter Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="meterNumber"
                  value={meterNumber}
                  onChange={(e) => setMeterNumber(e.target.value)}
                  placeholder="e.g., ELEC-001, WATER-001"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must be unique within your organization
                </p>
              </div>

              {/* Unit (kwh, cubic_meter, liter) */}
              <div className="space-y-2">
                <Label htmlFor="unit">
                  Unit <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={unit}
                  onValueChange={(value) => setUnit(value as MeterUnit)}
                  required
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kwh">kWh (Kilowatt-hour)</SelectItem>
                    <SelectItem value="cubic_meter">m³ (Cubic Meter)</SelectItem>
                    <SelectItem value="liter">L (Liter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Installation Date */}
              <div className="space-y-2">
                <Label htmlFor="installationDate">
                  Installation Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="installationDate"
                  type="date"
                  value={installationDate}
                  onChange={(e) => setInstallationDate(e.target.value)}
                  max={today}
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as MeterStatus)}
                  required
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="faulty">Faulty</SelectItem>
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
                  <Gauge className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Registering...' : 'Register Meter'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
