'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import {
  ArrowLeft,
  Gauge,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Building2,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { MeterType, MeterStatus, MeterUnit } from '@/lib/meters/meters';

interface Meter {
  _id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  assetId?: string | null;
  meterType: MeterType;
  meterNumber: string;
  unit: MeterUnit;
  installationDate: Date | string;
  status: MeterStatus;
  lastReading?: number | null;
  lastReadingDate?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MeterReading {
  _id: string;
  meterId: string;
  reading: number;
  readingDate: Date | string;
  readBy?: string | null;
  source: 'manual' | 'iot' | 'import';
  notes?: string | null;
  createdAt: Date | string;
}

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
}

interface MonthlyConsumption {
  year: number;
  month: number;
  consumption: number | null;
}

const STATUS_COLORS: Record<MeterStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  faulty: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const TYPE_LABELS: Record<MeterType, string> = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
};

const UNIT_LABELS: Record<MeterUnit, string> = {
  kwh: 'kWh',
  cubic_meter: 'm³',
  liter: 'L',
};

const SOURCE_LABELS: Record<'manual' | 'iot' | 'import', string> = {
  manual: 'Manual',
  iot: 'IoT',
  import: 'Import',
};

export default function MeterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meterId = params.id as string;

  const [meter, setMeter] = useState<Meter | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [building, setBuilding] = useState<Building | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyConsumption, setMonthlyConsumption] = useState<MonthlyConsumption[]>([]);
  const [consumptionLoading, setConsumptionLoading] = useState(false);

  const fetchMeter = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/meters/${meterId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch meter');
      }

      const data = await response.json();
      setMeter(data.meter);

      // Fetch building
      if (data.meter.buildingId) {
        const buildingResponse = await fetch(`/api/buildings/${data.meter.buildingId}`);
        if (buildingResponse.ok) {
          const buildingData = await buildingResponse.json();
          setBuilding(buildingData.building);
        }
      }

      // Fetch unit if exists
      if (data.meter.unitId) {
        const unitResponse = await fetch(`/api/units/${data.meter.unitId}`);
        if (unitResponse.ok) {
          const unitData = await unitResponse.json();
          setUnit(unitData.unit);
        }
      }
    } catch (err) {
      console.error('Failed to fetch meter:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meter');
    } finally {
      setLoading(false);
    }
  }, [meterId]);

  const fetchReadings = useCallback(async () => {
    try {
      const response = await fetch(`/api/meter-readings?meterId=${meterId}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setReadings(data.readings || []);
      }
    } catch (err) {
      console.error('Failed to fetch readings:', err);
    }
  }, [meterId]);

  const fetchConsumptionTrend = useCallback(async () => {
    try {
      setConsumptionLoading(true);
      // Fetch consumption trend via API
      const trendRes = await fetch(`/api/meters/${meterId}/consumption-trend?months=12`);
      const trend = trendRes.ok ? await trendRes.json() : [];
      setMonthlyConsumption(trend);
    } catch (err) {
      console.error('Failed to fetch consumption trend:', err);
    } finally {
      setConsumptionLoading(false);
    }
  }, [meterId]);

  useEffect(() => {
    if (meterId) {
      fetchMeter();
      fetchReadings();
      fetchConsumptionTrend();
    }
  }, [meterId, fetchMeter, fetchReadings, fetchConsumptionTrend]);

  const handleDelete = async () => {
    if (
      !confirm('Are you sure you want to delete this meter? This will set its status to inactive.')
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/meters/${meterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete meter');
      }

      router.push('/org/meters');
    } catch (err) {
      console.error('Failed to delete meter:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete meter');
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toLocaleString()} ${unit}`;
  };

  const formatMonthYear = (year: number, month: number) => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <DashboardPage
        title="Loading..."
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Meters', href: '/org/meters' },
          { label: 'Details' },
        ]}
      >
        <div className="col-span-full text-center py-8">Loading meter details...</div>
      </DashboardPage>
    );
  }

  if (error || !meter) {
    return (
      <DashboardPage
        title="Error"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Meters', href: '/org/meters' },
          { label: 'Details' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>{error || 'Meter not found'}</CardDescription>
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

  const readingColumns = [
    {
      key: 'readingDate',
      label: 'Date',
      render: (reading: MeterReading) => (
        <div className="text-sm">
          <div>{formatDateTime(reading.readingDate)}</div>
        </div>
      ),
    },
    {
      key: 'reading',
      label: 'Reading',
      render: (reading: MeterReading) => (
        <div className="font-medium">{formatNumber(reading.reading, UNIT_LABELS[meter.unit])}</div>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (reading: MeterReading) => (
        <Badge variant="outline">{SOURCE_LABELS[reading.source]}</Badge>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (reading: MeterReading) => (
        <div className="text-sm text-muted-foreground max-w-xs truncate">
          {reading.notes || '-'}
        </div>
      ),
    },
  ];

  return (
    <DashboardPage
      title={`Meter: ${meter.meterNumber}`}
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Meters', href: '/org/meters' },
        { label: meter.meterNumber },
      ]}
    >
      {/* Header Actions */}
      <div className="col-span-full flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/org/meters')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meters
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push(`/org/meters/${meterId}/readings/new`)}
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Reading
          </Button>
          {meter.status !== 'inactive' && (
            <Button onClick={handleDelete} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="col-span-full">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meter Details */}
      <Card className="col-span-full md:col-span-3">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                {meter.meterNumber}
              </CardTitle>
              <CardDescription className="mt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={STATUS_COLORS[meter.status]}>
                    {meter.status.charAt(0).toUpperCase() + meter.status.slice(1)}
                  </Badge>
                  <Badge variant="outline">{TYPE_LABELS[meter.meterType]}</Badge>
                  <Badge variant="outline">{UNIT_LABELS[meter.unit]}</Badge>
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Meter Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Building:</span>
              <span className="font-medium">{building?.name || meter.buildingId}</span>
            </div>
            {unit && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Unit:</span>
                <span className="font-medium">{unit.unitNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Installed:</span>
              <span>{formatDate(meter.installationDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Status:</span>
              <Badge className={STATUS_COLORS[meter.status]} variant="outline">
                {meter.status.charAt(0).toUpperCase() + meter.status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Last Reading */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  Last Reading
                </Label>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {formatNumber(meter.lastReading, UNIT_LABELS[meter.unit])}
                  </p>
                  {meter.lastReadingDate && (
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(meter.lastReadingDate)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consumption Summary */}
      <Card className="col-span-full md:col-span-1">
        <CardHeader>
          <CardTitle>Consumption Summary</CardTitle>
          <CardDescription>Monthly consumption trend</CardDescription>
        </CardHeader>
        <CardContent>
          {consumptionLoading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
          ) : monthlyConsumption.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No consumption data available
            </div>
          ) : (
            <div className="space-y-2">
              {monthlyConsumption
                .slice(-6)
                .reverse()
                .map((item) => (
                  <div
                    key={`${item.year}-${item.month}`}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-muted-foreground">
                      {formatMonthYear(item.year, item.month)}
                    </span>
                    <span className="font-medium">
                      {item.consumption !== null
                        ? formatNumber(item.consumption, UNIT_LABELS[meter.unit])
                        : 'N/A'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reading History */}
      <TableCard
        title="Reading History"
        subtitle={`${readings.length} reading${readings.length !== 1 ? 's' : ''} recorded`}
        columns={readingColumns as any}
        data={readings as any}
        loading={loading}
        error={error}
        onRetry={fetchReadings}
        colSpan={4}
      />
    </DashboardPage>
  );
}

// Label component (simple version)
function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  );
}
