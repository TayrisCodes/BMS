'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { StatCard } from '@/lib/components/dashboard/cards/StatCard';
import { TableCard } from '@/lib/components/dashboard/cards/TableCard';
import type { Column } from '@/lib/components/dashboard/cards/TableCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { ParkingSquare, CheckCircle2, XCircle, AlertCircle, Filter, Plus } from 'lucide-react';
import type { ParkingSpaceType, ParkingSpaceStatus } from '@/lib/parking/parking-spaces';

interface ParkingSpace extends Record<string, unknown> {
  _id: string;
  organizationId: string;
  buildingId: string;
  spaceNumber: string;
  spaceType: ParkingSpaceType;
  status: ParkingSpaceStatus;
  assignedTo?: string | null;
  vehicleId?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Building {
  _id: string;
  name: string;
}

interface ParkingSpaceStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
}

const STATUS_COLORS: Record<ParkingSpaceStatus, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  occupied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  reserved: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  maintenance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const TYPE_LABELS: Record<ParkingSpaceType, string> = {
  tenant: 'Tenant',
  visitor: 'Visitor',
  reserved: 'Reserved',
};

export default function ParkingSpacesPage() {
  const router = useRouter();
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [stats, setStats] = useState<ParkingSpaceStats>({
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    maintenance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<ParkingSpaceType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ParkingSpaceStatus | 'all'>('all');

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/buildings?status=active');
      if (!response.ok) {
        throw new Error('Failed to fetch buildings');
      }
      const data = await response.json();
      setBuildings(data.buildings || []);
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  const fetchParkingSpaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (buildingFilter !== 'all') {
        params.append('buildingId', buildingFilter);
      }
      if (typeFilter !== 'all') {
        params.append('spaceType', typeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/parking-spaces?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch parking spaces');
      }

      const data = await response.json();
      const fetchedSpaces = data.parkingSpaces || [];

      setParkingSpaces(fetchedSpaces);

      // Calculate stats
      const calculatedStats: ParkingSpaceStats = {
        total: fetchedSpaces.length,
        available: fetchedSpaces.filter((s: ParkingSpace) => s.status === 'available').length,
        occupied: fetchedSpaces.filter((s: ParkingSpace) => s.status === 'occupied').length,
        reserved: fetchedSpaces.filter((s: ParkingSpace) => s.status === 'reserved').length,
        maintenance: fetchedSpaces.filter((s: ParkingSpace) => s.status === 'maintenance').length,
      };
      setStats(calculatedStats);
    } catch (err) {
      console.error('Failed to fetch parking spaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load parking spaces');
    } finally {
      setLoading(false);
    }
  }, [buildingFilter, typeFilter, statusFilter]);

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    fetchParkingSpaces();
  }, [fetchParkingSpaces]);

  const getBuildingName = (buildingId: string) => {
    const building = buildings.find((b) => b._id === buildingId);
    return building?.name || buildingId;
  };

  const columns: Column<ParkingSpace>[] = [
    {
      key: 'spaceNumber',
      label: 'Space Number',
      render: (space: ParkingSpace) => (
        <div className="space-y-1">
          <div className="font-medium">{space.spaceNumber}</div>
          <div className="text-xs text-muted-foreground">{getBuildingName(space.buildingId)}</div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (space: ParkingSpace) => (
        <Badge variant="outline">{TYPE_LABELS[space.spaceType]}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (space: ParkingSpace) => (
        <Badge className={STATUS_COLORS[space.status]}>
          {space.status.charAt(0).toUpperCase() + space.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (space: ParkingSpace) => (
        <div className="text-sm">
          {space.assignedTo ? (
            <span className="text-muted-foreground">Tenant</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'vehicleId',
      label: 'Vehicle',
      render: (space: ParkingSpace) => (
        <div className="text-sm">
          {space.vehicleId ? (
            <Badge variant="outline">Assigned</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardPage
      title="Parking Spaces"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking' },
        { label: 'Spaces' },
      ]}
    >
      {/* Statistics Cards */}
      <StatCard
        label="Total Spaces"
        value={stats.total}
        icon={ParkingSquare}
        loading={loading}
        error={error}
        onRetry={fetchParkingSpaces}
      />
      <StatCard
        label="Available"
        value={stats.available}
        icon={CheckCircle2}
        loading={loading}
        error={error}
        onRetry={fetchParkingSpaces}
      />
      <StatCard
        label="Occupied"
        value={stats.occupied}
        icon={XCircle}
        loading={loading}
        error={error}
        onRetry={fetchParkingSpaces}
      />
      <StatCard
        label="Reserved"
        value={stats.reserved}
        icon={AlertCircle}
        loading={loading}
        error={error}
        onRetry={fetchParkingSpaces}
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

          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as ParkingSpaceType | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
              <SelectItem value="visitor">Visitor</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ParkingSpaceStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => router.push('/org/parking/spaces/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Parking Space
        </Button>
      </div>

      {/* Parking Spaces Table */}
      <TableCard<ParkingSpace>
        title="Parking Spaces"
        subtitle={`${parkingSpaces.length} space${parkingSpaces.length !== 1 ? 's' : ''} found`}
        columns={columns}
        data={parkingSpaces}
        loading={loading}
        error={error}
        onRetry={fetchParkingSpaces}
        onRowClick={(space) => router.push(`/org/parking/spaces/${space._id}`)}
        colSpan={4}
      />
    </DashboardPage>
  );
}
