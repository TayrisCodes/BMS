'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, UserCheck, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  spaceType: string;
  status: string;
  buildingId: string;
}

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string;
  entryTime: string;
}

interface ParkingPricing {
  _id: string;
  buildingId: string;
  spaceType: string;
  pricingModel: string;
  dailyRate: number | null;
  hourlyRate: number | null;
}

export default function AssignVisitorParkingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceIdParam = searchParams.get('spaceId');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [pricing, setPricing] = useState<ParkingPricing | null>(null);
  const [selectedVisitorLogId, setSelectedVisitorLogId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState<string>('');
  const [entryTime, setEntryTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [pricingModel, setPricingModel] = useState<'hourly' | 'daily'>('hourly');
  const [rate, setRate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [buildingsData, visitorLogsData] = await Promise.all([
          apiGet<{ buildings: Building[] }>('/api/buildings').catch(() => ({ buildings: [] })),
          apiGet<{ visitorLogs: VisitorLog[] }>('/api/visitor-logs?status=active').catch(() => ({
            visitorLogs: [],
          })),
        ]);

        setBuildings(buildingsData.buildings || []);
        setVisitorLogs(visitorLogsData.visitorLogs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch parking spaces when building is selected
  useEffect(() => {
    async function fetchParkingSpaces() {
      if (!selectedBuildingId) {
        setParkingSpaces([]);
        if (!spaceIdParam) {
          setSelectedSpaceId('');
        }
        return;
      }

      try {
        const response = await apiGet<{ parkingSpaces: ParkingSpace[] }>(
          `/api/parking-spaces?buildingId=${selectedBuildingId}&spaceType=visitor&status=available`,
        );
        const spaces = response.parkingSpaces || [];
        setParkingSpaces(spaces);

        // If spaceId is provided in query params, select it and set building
        if (spaceIdParam) {
          const space = spaces.find((s) => s._id === spaceIdParam);
          if (space) {
            setSelectedSpaceId(spaceIdParam);
            if (!selectedBuildingId) {
              setSelectedBuildingId(space.buildingId);
            }
          }
        } else {
          setSelectedSpaceId('');
        }
      } catch (err) {
        console.error('Failed to fetch parking spaces:', err);
        setParkingSpaces([]);
      }
    }

    fetchParkingSpaces();
  }, [selectedBuildingId, spaceIdParam]);

  // Fetch pricing when building and space are selected
  useEffect(() => {
    async function fetchPricing() {
      if (!selectedBuildingId || !selectedSpaceId) {
        setPricing(null);
        setRate('');
        return;
      }

      try {
        const response = await apiGet<{ parkingPricing: ParkingPricing[] }>(
          `/api/parking/pricing?buildingId=${selectedBuildingId}&spaceType=visitor&isActive=true`,
        );
        const activePricing = response.parkingPricing?.[0];
        if (activePricing) {
          setPricing(activePricing);
          if (pricingModel === 'hourly' && activePricing.hourlyRate) {
            setRate(activePricing.hourlyRate.toString());
          } else if (pricingModel === 'daily' && activePricing.dailyRate) {
            setRate(activePricing.dailyRate.toString());
          } else {
            setRate('');
          }
        } else {
          setPricing(null);
          setRate('');
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
        setPricing(null);
      }
    }

    fetchPricing();
  }, [selectedBuildingId, selectedSpaceId, pricingModel]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!selectedVisitorLogId || !selectedBuildingId || !selectedSpaceId || !rate) {
      setError('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    try {
      const assignmentData = {
        parkingSpaceId: selectedSpaceId,
        assignmentType: 'visitor' as const,
        visitorLogId: selectedVisitorLogId,
        vehicleId: null, // Visitor vehicles are tracked via plate number in visitor log
        startDate: entryTime,
        billingPeriod: pricingModel,
        rate: parseFloat(rate),
      };

      const response = await apiPost<{ message: string; parkingAssignment: { _id: string } }>(
        '/api/parking/assignments',
        assignmentData,
      );

      setSuccess('Parking assignment created successfully!');
      setTimeout(() => {
        router.push(`/org/parking/visitors/${response.parkingAssignment._id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create parking assignment');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Assign Visitor Parking"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Visitor Parking', href: '/org/parking/visitors' },
          { label: 'Assign', href: '#' },
        ]}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading form...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Assign Visitor Parking"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Visitor Parking', href: '/org/parking/visitors' },
        { label: 'Assign', href: '#' },
      ]}
    >
      <div className="col-span-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/org/parking/visitors')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Assign Visitor Parking</h2>
            <p className="text-sm text-muted-foreground">
              Assign a parking space to a visitor (hourly or daily)
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visitorLogId">
                    Visitor <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedVisitorLogId}
                    onValueChange={setSelectedVisitorLogId}
                    required
                  >
                    <SelectTrigger id="visitorLogId">
                      <SelectValue placeholder="Select visitor" />
                    </SelectTrigger>
                    <SelectContent>
                      {visitorLogs.map((log) => (
                        <SelectItem key={log._id} value={log._id}>
                          {log.visitorName}
                          {log.visitorPhone && ` - ${log.visitorPhone}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {visitorLogs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No active visitors found. Create a visitor log first.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buildingId">
                    Building <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                    <SelectTrigger id="buildingId">
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
                  <Label htmlFor="spaceId">
                    Parking Space <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedSpaceId}
                    onValueChange={setSelectedSpaceId}
                    required
                    disabled={!selectedBuildingId || parkingSpaces.length === 0}
                  >
                    <SelectTrigger id="spaceId">
                      <SelectValue placeholder="Select parking space" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingSpaces.map((space) => (
                        <SelectItem key={space._id} value={space._id}>
                          {space.spaceNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBuildingId && parkingSpaces.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No available visitor parking spaces in this building
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehiclePlateNumber">Vehicle Plate Number (Optional)</Label>
                  <Input
                    id="vehiclePlateNumber"
                    value={vehiclePlateNumber}
                    onChange={(e) => setVehiclePlateNumber(e.target.value)}
                    placeholder="ABC-1234"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entryTime">
                    Entry Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="entryTime"
                    type="datetime-local"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricingModel">
                    Pricing Model <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={pricingModel}
                    onValueChange={(v) => setPricingModel(v as 'hourly' | 'daily')}
                    required
                  >
                    <SelectTrigger id="pricingModel">
                      <SelectValue placeholder="Select pricing model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate">
                    Rate (ETB) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  {pricing && (
                    <p className="text-xs text-muted-foreground">
                      Default {pricingModel} rate from pricing config:{' '}
                      {pricingModel === 'hourly' ? pricing.hourlyRate : pricing.dailyRate} ETB
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/org/parking/visitors')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Assignment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}
