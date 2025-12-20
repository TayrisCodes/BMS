'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Gauge, Plus, Filter, CheckCircle2, XCircle, AlertTriangle, Receipt } from 'lucide-react';
import Link from 'next/link';
import type { MeterType, MeterStatus } from '@/lib/meters/meters';

interface Meter {
  _id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  assetId?: string | null;
  meterType: MeterType;
  meterNumber: string;
  unit: 'kwh' | 'cubic_meter' | 'liter';
  installationDate: Date | string;
  status: MeterStatus;
  lastReading?: number | null;
  lastReadingDate?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
}

interface MeterStats {
  total: number;
  active: number;
  inactive: number;
  faulty: number;
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

const UNIT_LABELS: Record<'kwh' | 'cubic_meter' | 'liter', string> = {
  kwh: 'kWh',
  cubic_meter: 'm³',
  liter: 'L',
};

export default function MetersPage() {
  const router = useRouter();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stats, setStats] = useState<MeterStats>({
    total: 0,
    active: 0,
    inactive: 0,
    faulty: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [meterTypeFilter, setMeterTypeFilter] = useState<MeterType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<MeterStatus | 'all'>('all');

  const fetchMeters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (buildingFilter !== 'all') {
        params.append('buildingId', buildingFilter);
      }
      if (unitFilter !== 'all') {
        params.append('unitId', unitFilter);
      }
      if (meterTypeFilter !== 'all') {
        params.append('meterType', meterTypeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/meters?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch meters');
      }

      const data = await response.json();
      const fetchedMeters = data.meters || [];

      setMeters(fetchedMeters);

      // Calculate stats
      const calculatedStats: MeterStats = {
        total: fetchedMeters.length,
        active: fetchedMeters.filter((m: Meter) => m.status === 'active').length,
        inactive: fetchedMeters.filter((m: Meter) => m.status === 'inactive').length,
        faulty: fetchedMeters.filter((m: Meter) => m.status === 'faulty').length,
      };
      setStats(calculatedStats);
    } catch (err) {
      console.error('Failed to fetch meters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meters');
    } finally {
      setLoading(false);
    }
  }, [buildingFilter, unitFilter, meterTypeFilter, statusFilter]);

  const fetchBuildings = useCallback(async () => {
    try {
      const response = await fetch('/api/buildings?status=active');
      if (response.ok) {
        const data = await response.json();
        setBuildings(data.buildings || []);
      }
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  }, []);

  const fetchUnits = useCallback(async (buildingId: string) => {
    try {
      const response = await fetch(`/api/units?buildingId=${buildingId}`);
      if (response.ok) {
        const data = await response.json();
        setUnits(data.units || []);
      }
    } catch (err) {
      console.error('Failed to fetch units:', err);
    }
  }, []);

  useEffect(() => {
    fetchMeters();
    fetchBuildings();
  }, [fetchMeters, fetchBuildings]);

  useEffect(() => {
    if (buildingFilter !== 'all') {
      fetchUnits(buildingFilter);
    } else {
      setUnits([]);
    }
  }, [buildingFilter, fetchUnits]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatNumber = (value: number | null | undefined, unit: string) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toLocaleString()} ${unit}`;
  };

  const columns = [
    {
      key: 'meterNumber',
      label: 'Meter Number',
      render: (meter: Meter) => (
        <div className="space-y-1">
          <div className="font-medium">{meter.meterNumber}</div>
          <div className="text-xs text-muted-foreground">{TYPE_LABELS[meter.meterType]}</div>
        </div>
      ),
    },
    {
      key: 'building',
      label: 'Building',
      render: (meter: Meter) => {
        const building = buildings.find((b) => b._id === meter.buildingId);
        return (
          <div className="text-sm">
            {building?.name || meter.buildingId}
            {meter.unitId && (
              <div className="text-xs text-muted-foreground">
                Unit: {units.find((u) => u._id === meter.unitId)?.unitNumber || meter.unitId}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'lastReading',
      label: 'Last Reading',
      render: (meter: Meter) => (
        <div className="text-sm">
          <div>{formatNumber(meter.lastReading, UNIT_LABELS[meter.unit])}</div>
          {meter.lastReadingDate && (
            <div className="text-xs text-muted-foreground">{formatDate(meter.lastReadingDate)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (meter: Meter) => (
        <Badge className={STATUS_COLORS[meter.status]}>
          {meter.status.charAt(0).toUpperCase() + meter.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'installationDate',
      label: 'Installed',
      render: (meter: Meter) => <div className="text-sm">{formatDate(meter.installationDate)}</div>,
    },
  ];

  return (
    <DashboardPage
      title="Meters Management"
      breadcrumbs={[{ label: 'Organization', href: '/org' }, { label: 'Meters' }]}
    >
      {/* Statistics Cards */}
      <StatCard
        label="Total Meters"
        value={stats.total}
        icon={Gauge}
        loading={loading}
        error={error}
        onRetry={fetchMeters}
      />
      <StatCard
        label="Active"
        value={stats.active}
        icon={CheckCircle2}
        loading={loading}
        error={error}
        onRetry={fetchMeters}
      />
      <StatCard
        label="Inactive"
        value={stats.inactive}
        icon={XCircle}
        loading={loading}
        error={error}
        onRetry={fetchMeters}
      />
      <StatCard
        label="Faulty"
        value={stats.faulty}
        icon={AlertTriangle}
        loading={loading}
        error={error}
        onRetry={fetchMeters}
      />

      {/* Filters and Actions */}
      <div className="col-span-full flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by building" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {buildings.map((building) => (
                <SelectItem key={building._id} value={building._id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {buildingFilter !== 'all' && (
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit._id} value={unit._id}>
                    {unit.unitNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={meterTypeFilter}
            onValueChange={(value) => setMeterTypeFilter(value as MeterType | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="electricity">Electricity</SelectItem>
              <SelectItem value="water">Water</SelectItem>
              <SelectItem value="gas">Gas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as MeterStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="faulty">Faulty</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Link href="/org/utilities/payments">
            <Button variant="outline">
              <Receipt className="h-4 w-4 mr-2" />
              Utility Payments
            </Button>
          </Link>
          <Button onClick={() => router.push('/org/meters/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Register Meter
          </Button>
        </div>
      </div>

      {/* Meters Table */}
      <TableCard
        title="Meters"
        subtitle={`${meters.length} meter${meters.length !== 1 ? 's' : ''} found`}
        columns={columns as any}
        data={meters as any}
        loading={loading}
        error={error}
        onRetry={fetchMeters}
        onRowClick={(meter) => router.push(`/org/meters/${meter._id}`)}
        colSpan={4}
      />
    </DashboardPage>
  );
}
