'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet } from '@/lib/utils/api-client';
import { FileText, Plus, Eye } from 'lucide-react';

interface Lease {
  _id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate?: string | null;
  rentAmount: number;
  status: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

interface Building {
  _id: string;
  name: string;
}

export default function LeasesPage() {
  const router = useRouter();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [filteredLeases, setFilteredLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Record<string, Tenant>>({});
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const leasesData = (await apiGet<{ leases: Lease[] }>('/api/leases')) as {
          leases: Lease[];
        };
        setLeases(leasesData.leases || []);
        setFilteredLeases(leasesData.leases || []);

        // Fetch related data
        const tenantIds = [...new Set(leasesData.leases?.map((l) => l.tenantId) || [])];
        const unitIds = [...new Set(leasesData.leases?.map((l) => l.unitId) || [])];

        const tenantMap: Record<string, Tenant> = {};
        const unitMap: Record<string, Unit> = {};
        const buildingMap: Record<string, Building> = {};

        for (const tenantId of tenantIds) {
          try {
            const tenantData = await apiGet<{ tenant: Tenant }>(`/api/tenants/${tenantId}`);
            tenantMap[tenantId] = tenantData.tenant;
          } catch {
            // Tenant not found
          }
        }

        for (const unitId of unitIds) {
          try {
            const unitData = await apiGet<{ unit: Unit }>(`/api/units/${unitId}`);
            unitMap[unitId] = unitData.unit;

            if (!buildingMap[unitData.unit.buildingId]) {
              const buildingData = await apiGet<{ building: Building }>(
                `/api/buildings/${unitData.unit.buildingId}`,
              );
              buildingMap[unitData.unit.buildingId] = buildingData.building;
            }
          } catch {
            // Unit not found
          }
        }

        setTenants(tenantMap);
        setUnits(unitMap);
        setBuildings(buildingMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leases');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = leases;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    setFilteredLeases(filtered);
  }, [statusFilter, leases]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading leases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Leases</h1>
            <p className="text-muted-foreground">Manage lease agreements</p>
          </div>
        </div>
        <Link href="/admin/leases/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Lease
          </Button>
        </Link>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Rent Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {leases.length === 0
                      ? 'No leases found. Create your first lease.'
                      : 'No leases match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredLeases.map((lease) => {
                const tenant = tenants[lease.tenantId];
                const unit = units[lease.unitId];
                const building = unit ? buildings[unit.buildingId] : null;
                return (
                  <TableRow key={lease._id}>
                    <TableCell className="font-medium">
                      {tenant ? `${tenant.firstName} ${tenant.lastName}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {building && unit ? `${building.name} - ${unit.unitNumber}` : 'N/A'}
                    </TableCell>
                    <TableCell>{new Date(lease.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Ongoing'}
                    </TableCell>
                    <TableCell>ETB {lease.rentAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          lease.status === 'active'
                            ? 'default'
                            : lease.status === 'expired' || lease.status === 'terminated'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {lease.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/leases/${lease._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
