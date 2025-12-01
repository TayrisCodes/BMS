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
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  XCircle,
} from 'lucide-react';
import type { MeterReadingSource } from '@/lib/meter-readings/meter-readings';

interface Meter {
  _id: string;
  meterNumber: string;
  meterType: string;
  unit: 'kwh' | 'cubic_meter' | 'liter';
  lastReading?: number | null;
  buildingId: string;
  buildingName?: string;
}

interface BulkReadingEntry {
  meterId: string;
  reading: string;
  readingDate: string;
  notes: string;
  source: MeterReadingSource;
  allowDecrease: boolean;
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

export default function BulkReadingPage() {
  const router = useRouter();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [entries, setEntries] = useState<BulkReadingEntry[]>([]);
  const [readingDate, setReadingDate] = useState<string>('');
  const [source, setSource] = useState<MeterReadingSource>('import');

  useEffect(() => {
    fetchMeters();
    // Set default reading date to today
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setReadingDate(localDateTime);
  }, []);

  const fetchMeters = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meters?status=active');
      if (response.ok) {
        const data = await response.json();
        const metersData = data.meters || [];

        // Fetch building names for each meter
        const metersWithBuildings = await Promise.all(
          metersData.map(async (meter: Meter) => {
            try {
              const buildingResponse = await fetch(`/api/buildings/${meter.buildingId}`);
              if (buildingResponse.ok) {
                const buildingData = await buildingResponse.json();
                return { ...meter, buildingName: buildingData.building?.name };
              }
            } catch {
              // Ignore errors
            }
            return meter;
          }),
        );

        setMeters(metersWithBuildings);
      }
    } catch (err) {
      console.error('Failed to fetch meters:', err);
      setError('Failed to load meters');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = () => {
    setEntries([
      ...entries,
      {
        meterId: '',
        reading: '',
        readingDate: readingDate || '',
        notes: '',
        source,
        allowDecrease: false,
      },
    ]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleEntryChange = (
    index: number,
    field: keyof BulkReadingEntry,
    value: string | boolean,
  ) => {
    const updated = [...entries];
    updated[index] = { ...updated[index]!, [field]: value } as BulkReadingEntry;
    setEntries(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        // Expected CSV format: meterNumber,reading,readingDate,notes
        const csvEntries: BulkReadingEntry[] = [];
        for (let i = 1; i < lines.length; i++) {
          // Skip header row
          const line = lines[i];
          if (!line) continue;
          const parts = line.split(',').map((s) => s.trim());
          const meterNumber = parts[0];
          const reading = parts[1];
          const readingDate = parts[2] || '';
          const notes = parts[3] || '';

          if (!meterNumber || !reading) continue;

          // Find meter by meter number
          const meter = meters.find((m) => m.meterNumber === meterNumber);
          if (!meter) continue;

          csvEntries.push({
            meterId: meter._id,
            reading,
            readingDate: readingDate || readingDate || '',
            notes: notes || '',
            source: 'import',
            allowDecrease: false,
          });
        }

        setEntries([...entries, ...csvEntries]);
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const validateEntries = (): string | null => {
    for (const entry of entries) {
      if (!entry.meterId) {
        return 'All entries must have a meter selected';
      }
      if (!entry.reading || isNaN(parseFloat(entry.reading))) {
        return 'All entries must have a valid reading value';
      }
      if (!entry.readingDate) {
        return 'All entries must have a reading date';
      }
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const validationError = validateEntries();
      if (validationError) {
        throw new Error(validationError);
      }

      // Submit all entries
      const results = await Promise.allSettled(
        entries.map(async (entry) => {
          const response = await fetch('/api/meter-readings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              meterId: entry.meterId,
              reading: parseFloat(entry.reading),
              readingDate: new Date(entry.readingDate || readingDate).toISOString(),
              source: entry.source,
              notes: entry.notes || null,
              allowDecrease: entry.allowDecrease,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create reading');
          }

          return response.json();
        }),
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        setError(
          `${successful} reading(s) created successfully, ${failed} failed. Check individual entries for errors.`,
        );
      } else {
        setSuccess(`Successfully created ${successful} reading(s)`);
        setEntries([]);
        setTimeout(() => {
          router.push('/org/meters');
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to submit bulk readings:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit bulk readings');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current date/time in local format for datetime-local input
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const getMeterDisplay = (meterId: string) => {
    const meter = meters.find((m) => m._id === meterId);
    if (!meter) return 'Select meter';
    return `${meter.meterNumber} (${meter.buildingName || meter.buildingId})`;
  };

  return (
    <DashboardPage
      title="Bulk Reading Entry"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Meters', href: '/org/meters' },
        { label: 'Bulk Reading Entry' },
      ]}
    >
      <div className="col-span-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Upload className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Bulk Meter Reading Entry</CardTitle>
                <CardDescription>
                  Enter readings for multiple meters at once or upload a CSV file
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

              {success && (
                <div className="bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 p-4 rounded-lg flex items-center gap-2 border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{success}</span>
                </div>
              )}

              {/* Default Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="defaultReadingDate">Default Reading Date</Label>
                  <Input
                    id="defaultReadingDate"
                    type="datetime-local"
                    value={readingDate}
                    onChange={(e) => {
                      setReadingDate(e.target.value);
                      // Update all entries that haven't been customized
                      setEntries(
                        entries.map((entry) => ({
                          ...entry,
                          readingDate: entry.readingDate || e.target.value,
                        })),
                      );
                    }}
                    max={localDateTime}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultSource">Default Source</Label>
                  <Select
                    value={source}
                    onValueChange={(value) => {
                      setSource(value as MeterReadingSource);
                      setEntries(
                        entries.map((entry) => ({
                          ...entry,
                          source: value as MeterReadingSource,
                        })),
                      );
                    }}
                  >
                    <SelectTrigger id="defaultSource">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{SOURCE_LABELS.manual}</SelectItem>
                      <SelectItem value="iot">{SOURCE_LABELS.iot}</SelectItem>
                      <SelectItem value="import">{SOURCE_LABELS.import}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CSV Upload */}
              <div className="space-y-2">
                <Label>Upload CSV File (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  CSV format: meterNumber,reading,readingDate,notes (one reading per line, header
                  row will be skipped)
                </p>
              </div>

              {/* Manual Entries */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Reading Entries</Label>
                  <Button type="button" onClick={handleAddEntry} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </div>

                {entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    <p className="mb-2">No entries yet</p>
                    <Button type="button" onClick={handleAddEntry} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Entry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {entries.map((entry, index) => {
                      const selectedMeter = meters.find((m) => m._id === entry.meterId);
                      return (
                        <Card key={index} className="p-4">
                          <div className="flex items-start justify-between mb-4">
                            <h4 className="font-medium">Entry {index + 1}</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEntry(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Meter Selection */}
                            <div className="space-y-2">
                              <Label>
                                Meter <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                value={entry.meterId}
                                onValueChange={(value) =>
                                  handleEntryChange(index, 'meterId', value)
                                }
                                required
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select meter" />
                                </SelectTrigger>
                                <SelectContent>
                                  {meters.map((meter) => (
                                    <SelectItem key={meter._id} value={meter._id}>
                                      {meter.meterNumber} ({meter.buildingName || meter.buildingId})
                                      - {UNIT_LABELS[meter.unit]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedMeter?.lastReading !== null &&
                                selectedMeter?.lastReading !== undefined && (
                                  <p className="text-xs text-muted-foreground">
                                    Last: {selectedMeter.lastReading.toLocaleString()}{' '}
                                    {UNIT_LABELS[selectedMeter.unit]}
                                  </p>
                                )}
                            </div>

                            {/* Reading Value */}
                            <div className="space-y-2">
                              <Label>
                                Reading ({selectedMeter ? UNIT_LABELS[selectedMeter.unit] : ''}){' '}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={entry.reading}
                                onChange={(e) =>
                                  handleEntryChange(index, 'reading', e.target.value)
                                }
                                placeholder="Enter reading"
                                required
                              />
                            </div>

                            {/* Reading Date */}
                            <div className="space-y-2">
                              <Label>
                                Reading Date <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="datetime-local"
                                value={entry.readingDate || readingDate}
                                onChange={(e) =>
                                  handleEntryChange(index, 'readingDate', e.target.value)
                                }
                                max={localDateTime}
                                required
                              />
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                              <Label>Notes (Optional)</Label>
                              <Input
                                value={entry.notes}
                                onChange={(e) => handleEntryChange(index, 'notes', e.target.value)}
                                placeholder="Optional notes"
                              />
                            </div>
                          </div>

                          {/* Allow Decrease */}
                          <div className="mt-4 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={entry.allowDecrease}
                              onChange={(e) =>
                                handleEntryChange(index, 'allowDecrease', e.target.checked)
                              }
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label className="text-sm font-normal cursor-pointer">
                              Allow reading to be less than last reading (for corrections)
                            </Label>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/org/meters')}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || entries.length === 0}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Submitting...' : `Submit ${entries.length} Reading(s)`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
