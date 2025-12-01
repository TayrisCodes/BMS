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
import { Car, CheckCircle2, XCircle, Filter, Plus } from 'lucide-react';
import type { VehicleStatus } from '@/lib/parking/vehicles';

interface Vehicle extends Record<string, unknown> {
  _id: string;
  organizationId: string;
  tenantId: string;
  plateNumber: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  parkingSpaceId?: string | null;
  status: VehicleStatus;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

interface VehicleStats {
  total: number;
  active: number;
  inactive: number;
}

const STATUS_COLORS: Record<VehicleStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<VehicleStats>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants?status=active');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (tenantFilter !== 'all') {
        params.append('tenantId', tenantFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/vehicles?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }

      const data = await response.json();
      const fetchedVehicles = data.vehicles || [];

      setVehicles(fetchedVehicles);

      // Calculate stats
      const calculatedStats: VehicleStats = {
        total: fetchedVehicles.length,
        active: fetchedVehicles.filter((v: Vehicle) => v.status === 'active').length,
        inactive: fetchedVehicles.filter((v: Vehicle) => v.status === 'inactive').length,
      };
      setStats(calculatedStats);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [tenantFilter, statusFilter]);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find((t) => t._id === tenantId);
    return tenant ? `${tenant.firstName} ${tenant.lastName}` : tenantId;
  };

  const columns: Column<Vehicle>[] = [
    {
      key: 'plateNumber',
      label: 'Plate Number',
      render: (vehicle: Vehicle) => (
        <div className="space-y-1">
          <div className="font-medium">{vehicle.plateNumber}</div>
          {vehicle.make && vehicle.model && (
            <div className="text-xs text-muted-foreground">
              {vehicle.make} {vehicle.model}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'tenant',
      label: 'Tenant',
      render: (vehicle: Vehicle) => (
        <div className="text-sm">{getTenantName(vehicle.tenantId)}</div>
      ),
    },
    {
      key: 'parkingSpace',
      label: 'Parking Space',
      render: (vehicle: Vehicle) => (
        <div className="text-sm">
          {vehicle.parkingSpaceId ? (
            <Badge variant="outline">Assigned</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (vehicle: Vehicle) => (
        <Badge className={STATUS_COLORS[vehicle.status]}>
          {vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardPage
      title="Vehicles"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking' },
        { label: 'Vehicles' },
      ]}
    >
      {/* Statistics Cards */}
      <StatCard
        label="Total Vehicles"
        value={stats.total}
        icon={Car}
        loading={loading}
        error={error}
        onRetry={fetchVehicles}
      />
      <StatCard
        label="Active"
        value={stats.active}
        icon={CheckCircle2}
        loading={loading}
        error={error}
        onRetry={fetchVehicles}
      />
      <StatCard
        label="Inactive"
        value={stats.inactive}
        icon={XCircle}
        loading={loading}
        error={error}
        onRetry={fetchVehicles}
      />

      {/* Filters and Actions */}
      <div className="col-span-full flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              {tenants.map((tenant) => (
                <SelectItem key={tenant._id} value={tenant._id}>
                  {tenant.firstName} {tenant.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as VehicleStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => router.push('/org/parking/vehicles/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Register Vehicle
        </Button>
      </div>

      {/* Vehicles Table */}
      <TableCard<Vehicle>
        title="Vehicles"
        subtitle={`${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} found`}
        columns={columns}
        data={vehicles}
        loading={loading}
        error={error}
        onRetry={fetchVehicles}
        onRowClick={(vehicle) => router.push(`/org/parking/vehicles/${vehicle._id}`)}
        colSpan={3}
      />
    </DashboardPage>
  );
}
