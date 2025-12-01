'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { ArrowLeft, Plus, AlertCircle, Gauge, Info } from 'lucide-react';
import type { MeterReadingSource } from '@/lib/meter-readings/meter-readings';

interface Meter {
  _id: string;
  meterNumber: string;
  meterType: string;
  unit: 'kwh' | 'cubic_meter' | 'liter';
  lastReading?: number | null;
  lastReadingDate?: Date | string | null;
}

const UNIT_LABELS: Record<'kwh' | 'cubic_meter' | 'liter', string> = {
  kwh: 'kWh',
  cubic_meter: 'm³',
  liter: 'L',
};

const SOURCE_LABELS: Record<MeterReadingSource, string> = {
  manual: 'Manual Entry',
  iot: 'IoT Device',
  import: 'CSV Import',
};

export default function NewReadingPage() {
  const router = useRouter();
  const params = useParams();
  const meterId = params.id as string;

  const [meter, setMeter] = useState<Meter | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [reading, setReading] = useState<string>('');
  const [readingDate, setReadingDate] = useState<string>('');
  const [source, setSource] = useState<MeterReadingSource>('manual');
  const [notes, setNotes] = useState<string>('');
  const [allowDecrease, setAllowDecrease] = useState<boolean>(false);

  const fetchMeter = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/meters/${meterId}`);
      if (response.ok) {
        const data = await response.json();
        setMeter(data.meter);
      } else {
        throw new Error('Failed to fetch meter');
      }
    } catch (err) {
      console.error('Failed to fetch meter:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meter');
    } finally {
      setLoading(false);
    }
  }, [meterId]);

  useEffect(() => {
    if (meterId) {
      fetchMeter();
    }
  }, [meterId, fetchMeter]);

  // Set default reading date to today
  useEffect(() => {
    if (!readingDate) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setReadingDate(localDateTime);
    }
  }, [readingDate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!reading || !readingDate) {
        throw new Error('Reading value and date are required');
      }

      const readingValue = parseFloat(reading);
      if (isNaN(readingValue) || readingValue < 0) {
        throw new Error('Reading must be a non-negative number');
      }

      // Check if reading is less than last reading
      if (
        !allowDecrease &&
        meter?.lastReading !== null &&
        meter?.lastReading !== undefined &&
        readingValue < meter.lastReading
      ) {
        throw new Error(
          `Reading (${readingValue}) must be greater than or equal to last reading (${meter.lastReading}). Check "Allow decrease" for corrections.`,
        );
      }

      const readingData = {
        meterId,
        reading: readingValue,
        readingDate: new Date(readingDate).toISOString(),
        source,
        notes: notes.trim() || null,
        allowDecrease,
      };

      const response = await fetch('/api/meter-readings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(readingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create meter reading');
      }

      const data = await response.json();
      router.push(`/org/meters/${meterId}`);
    } catch (err) {
      console.error('Failed to create reading:', err);
      setError(err instanceof Error ? err.message : 'Failed to create meter reading');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current date/time in local format for datetime-local input
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  if (loading) {
    return (
      <DashboardPage
        title="Loading..."
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Meters', href: '/org/meters' },
          { label: 'Add Reading' },
        ]}
      >
        <div className="col-span-full text-center py-8">Loading...</div>
      </DashboardPage>
    );
  }

  if (error && !meter) {
    return (
      <DashboardPage
        title="Error"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Meters', href: '/org/meters' },
          { label: 'Add Reading' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/org/meters')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Meters
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Add Meter Reading"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Meters', href: '/org/meters' },
        ...(meterId
          ? [{ label: meter?.meterNumber || 'Meter', href: `/org/meters/${meterId}` }]
          : [{ label: meter?.meterNumber || 'Meter' }]),
        { label: 'Add Reading' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Plus className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Add Meter Reading</CardTitle>
                <CardDescription>
                  Record a new reading for meter: {meter?.meterNumber}
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

              {/* Last Reading Info */}
              {meter?.lastReading !== null && meter?.lastReading !== undefined && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Last Reading
                    </Label>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {meter.lastReading.toLocaleString()} {UNIT_LABELS[meter.unit]}
                    {meter.lastReadingDate && (
                      <span className="ml-2">
                        (on {new Date(meter.lastReadingDate).toLocaleDateString()})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    New reading should be greater than or equal to last reading, unless this is a
                    correction.
                  </p>
                </div>
              )}

              {/* Reading Value */}
              <div className="space-y-2">
                <Label htmlFor="reading">
                  Reading Value ({meter?.unit ? UNIT_LABELS[meter.unit] : ''}){' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reading"
                  type="number"
                  step="0.01"
                  min="0"
                  value={reading}
                  onChange={(e) => setReading(e.target.value)}
                  placeholder="Enter reading value"
                  required
                />
                {meter?.lastReading !== null &&
                  meter?.lastReading !== undefined &&
                  reading &&
                  !isNaN(parseFloat(reading)) && (
                    <p className="text-xs text-muted-foreground">
                      Last reading: {meter.lastReading.toLocaleString()} {UNIT_LABELS[meter.unit]}
                      {parseFloat(reading) < meter.lastReading && !allowDecrease && (
                        <span className="text-destructive ml-2">
                          (Warning: Less than last reading - check &quot;Allow decrease&quot; for
                          corrections)
                        </span>
                      )}
                    </p>
                  )}
              </div>

              {/* Reading Date */}
              <div className="space-y-2">
                <Label htmlFor="readingDate">
                  Reading Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="readingDate"
                  type="datetime-local"
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                  max={localDateTime}
                  required
                />
              </div>

              {/* Source */}
              <div className="space-y-2">
                <Label htmlFor="source">
                  Source <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={source}
                  onValueChange={(value) => setSource(value as MeterReadingSource)}
                  required
                >
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{SOURCE_LABELS.manual}</SelectItem>
                    <SelectItem value="iot">{SOURCE_LABELS.iot}</SelectItem>
                    <SelectItem value="import">{SOURCE_LABELS.import}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this reading..."
                  rows={3}
                />
              </div>

              {/* Allow Decrease (for corrections) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="allowDecrease"
                    type="checkbox"
                    checked={allowDecrease}
                    onChange={(e) => setAllowDecrease(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="allowDecrease" className="text-sm font-normal cursor-pointer">
                    Allow reading to be less than last reading (for corrections)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Check this if you need to correct a previous reading
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/org/meters/${meterId}`)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Adding...' : 'Add Reading'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
