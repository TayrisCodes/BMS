'use client';

import { useEffect, useState } from 'react';
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
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, DollarSign, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
}

export default function NewParkingPricingPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [spaceType, setSpaceType] = useState<'tenant' | 'visitor'>('tenant');
  const [pricingModel, setPricingModel] = useState<'monthly' | 'daily' | 'hourly'>('monthly');
  const [monthlyRate, setMonthlyRate] = useState<string>('');
  const [dailyRate, setDailyRate] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const buildingsData = await apiGet<{ buildings: Building[] }>('/api/buildings').catch(
          () => ({ buildings: [] }),
        );
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Update pricing model based on space type
  useEffect(() => {
    if (spaceType === 'tenant') {
      setPricingModel('monthly');
    } else {
      setPricingModel('hourly');
    }
  }, [spaceType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!selectedBuildingId || !spaceType || !pricingModel || !effectiveFrom) {
      setError('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    // Validate rates based on pricing model
    if (spaceType === 'tenant' && pricingModel === 'monthly' && !monthlyRate) {
      setError('Monthly rate is required for tenant monthly parking');
      setIsSubmitting(false);
      return;
    }

    if (spaceType === 'visitor') {
      if (pricingModel === 'daily' && !dailyRate) {
        setError('Daily rate is required for visitor daily parking');
        setIsSubmitting(false);
        return;
      }
      if (pricingModel === 'hourly' && !hourlyRate) {
        setError('Hourly rate is required for visitor hourly parking');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const pricingData = {
        buildingId: selectedBuildingId,
        spaceType,
        pricingModel,
        monthlyRate: monthlyRate ? parseFloat(monthlyRate) : null,
        dailyRate: dailyRate ? parseFloat(dailyRate) : null,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        currency: 'ETB',
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive,
      };

      const response = await apiPost<{ message: string; parkingPricing: { _id: string } }>(
        '/api/parking/pricing',
        pricingData,
      );

      setSuccess('Parking pricing created successfully!');
      setTimeout(() => {
        router.push('/org/parking/pricing');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create parking pricing');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="New Parking Pricing"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Pricing', href: '/org/parking/pricing' },
          { label: 'New', href: '#' },
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
      title="New Parking Pricing"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Pricing', href: '/org/parking/pricing' },
        { label: 'New', href: '#' },
      ]}
    >
      <div className="col-span-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/org/parking/pricing')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">New Parking Pricing</h2>
            <p className="text-sm text-muted-foreground">
              Configure parking rates for tenants or visitors
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
              <CardTitle>Pricing Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="spaceType">
                    Space Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={spaceType}
                    onValueChange={(value) => setSpaceType(value as 'tenant' | 'visitor')}
                    required
                  >
                    <SelectTrigger id="spaceType">
                      <SelectValue placeholder="Select space type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="visitor">Visitor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricingModel">
                    Pricing Model <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={pricingModel}
                    onValueChange={(value) =>
                      setPricingModel(value as 'monthly' | 'daily' | 'hourly')
                    }
                    required
                    disabled={spaceType === 'tenant'}
                  >
                    <SelectTrigger id="pricingModel">
                      <SelectValue placeholder="Select pricing model" />
                    </SelectTrigger>
                    <SelectContent>
                      {spaceType === 'tenant' ? (
                        <SelectItem value="monthly">Monthly</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {spaceType === 'tenant' && (
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRate">
                      Monthly Rate (ETB) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="monthlyRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={monthlyRate}
                      onChange={(e) => setMonthlyRate(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                )}

                {spaceType === 'visitor' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">
                        Hourly Rate (ETB)
                        {pricingModel === 'hourly' && <span className="text-destructive"> *</span>}
                      </Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        placeholder="0.00"
                        required={pricingModel === 'hourly'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dailyRate">
                        Daily Rate (ETB)
                        {pricingModel === 'daily' && <span className="text-destructive"> *</span>}
                      </Label>
                      <Input
                        id="dailyRate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={dailyRate}
                        onChange={(e) => setDailyRate(e.target.value)}
                        placeholder="0.00"
                        required={pricingModel === 'daily'}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="effectiveFrom">
                    Effective From <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="effectiveTo">Effective To (Optional)</Label>
                  <Input
                    id="effectiveTo"
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for ongoing pricing</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active (pricing will be used for new assignments)
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/org/parking/pricing')}
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
                  Create Pricing
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}
