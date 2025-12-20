'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/lib/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  FileText,
  Plus,
  Eye,
  Search,
  Loader2,
  Calendar,
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  Filter,
  X,
} from 'lucide-react';

interface Lease {
  _id: string;
  tenantId: string;
  unitId: string;
  buildingId?: string | null;
  startDate: string;
  endDate?: string | null;
  rentAmount?: number;
  billingCycle?: string;
  status: string;
  terms?: {
    rent: number;
    serviceCharges?: number | null;
    deposit?: number | null;
  };
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

export default function OrgLeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [filteredLeases, setFilteredLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Record<string, Tenant>>({});
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const leasesData = await apiGet<{ leases: Lease[] }>('/api/leases');
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

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    // Filter by search term (tenant name or unit number)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((lease) => {
        const tenant = tenants[lease.tenantId];
        const unit = units[lease.unitId];
        const building = unit ? buildings[unit.buildingId] : null;

        const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.toLowerCase() : '';
        const unitInfo =
          building && unit ? `${building.name} ${unit.unitNumber}`.toLowerCase() : '';

        return tenantName.includes(searchLower) || unitInfo.includes(searchLower);
      });
    }

    setFilteredLeases(filtered);
  }, [statusFilter, searchTerm, leases, tenants, units, buildings]);

  // Calculate statistics
  const activeLeases = filteredLeases.filter((l) => l.status === 'active');
  const totalMonthlyRent = activeLeases.reduce(
    (sum, l) =>
      sum +
      (l.billingCycle === 'monthly'
        ? (l.rentAmount ?? l.terms?.rent ?? 0)
        : l.billingCycle === 'quarterly'
          ? (l.rentAmount ?? l.terms?.rent ?? 0) / 3
          : l.billingCycle === 'annually'
            ? (l.rentAmount ?? l.terms?.rent ?? 0) / 12
            : (l.rentAmount ?? l.terms?.rent ?? 0)),
    0,
  );

  const hasActiveFilters = statusFilter !== 'all' || searchTerm.length > 0;

  if (isLoading) {
    return (
      <DashboardPage
        title="Leases"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Leases', href: '/org/leases' },
        ]}
      >
        <div className="col-span-full flex flex-col items-center justify-center h-96 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground text-lg">Loading leases...</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Leases"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Leases', href: '/org/leases' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Leases
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredLeases.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{leases.length} total in system</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Leases
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {activeLeases.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredLeases.length > 0
                  ? `${Math.round((activeLeases.length / filteredLeases.length) * 100)}% of filtered`
                  : 'No leases'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ETB {totalMonthlyRent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">From active leases</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expiring Soon
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {
                  filteredLeases.filter((l) => {
                    if (!l.endDate || l.status !== 'active') return false;
                    const endDate = new Date(l.endDate);
                    const today = new Date();
                    const daysUntilExpiry = Math.ceil(
                      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                  }).length
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Lease Management</CardTitle>
              </div>
              <Link href="/org/leases/new">
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Lease
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by tenant name, building, or unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
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
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchTerm('');
                    }}
                    className="flex-shrink-0"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Section */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Tenant</TableHead>
                    <TableHead className="font-semibold">Unit</TableHead>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Start Date
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        End Date
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Rent Amount
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="rounded-full bg-muted p-4">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                          <div className="space-y-2 text-center">
                            <p className="text-lg font-semibold text-foreground">
                              {leases.length === 0
                                ? 'No leases found'
                                : 'No leases match your filters'}
                            </p>
                            <p className="text-sm text-muted-foreground max-w-md">
                              {leases.length === 0
                                ? 'Get started by creating your first lease agreement. This will help you track rent payments and manage tenant relationships.'
                                : "Try adjusting your search or filter criteria to find what you're looking for."}
                            </p>
                          </div>
                          {leases.length === 0 && (
                            <Link href="/org/leases/new">
                              <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Lease
                              </Button>
                            </Link>
                          )}
                          {hasActiveFilters && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setStatusFilter('all');
                                setSearchTerm('');
                              }}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeases.map((lease) => {
                      const tenant = tenants[lease.tenantId];
                      const unit = units[lease.unitId];
                      const building = unit ? buildings[unit.buildingId] : null;
                      const endDate = lease.endDate ? new Date(lease.endDate) : null;
                      const today = new Date();
                      const isExpiringSoon =
                        endDate &&
                        lease.status === 'active' &&
                        endDate > today &&
                        endDate <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

                      return (
                        <TableRow
                          key={lease._id}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          <TableCell className="font-medium">
                            {tenant ? (
                              <Link
                                href={`/org/tenants/${tenant._id}`}
                                className="flex items-center gap-2 hover:text-primary transition-colors group/link"
                                title={`${tenant.firstName} ${tenant.lastName}`}
                              >
                                <Users className="h-4 w-4 text-muted-foreground group-hover/link:text-primary transition-colors" />
                                <span className="truncate">
                                  {tenant.firstName} {tenant.lastName}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                N/A
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {building && unit ? (
                              <Link
                                href={`/org/units/${unit._id}`}
                                className="hover:text-primary transition-colors group/unit"
                                title={`${building.name} - ${unit.unitNumber}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground group-hover/unit:text-primary transition-colors" />
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{building.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Unit {unit.unitNumber}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                N/A
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {new Date(lease.startDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {endDate ? (
                              <div
                                className={`flex items-center gap-2 text-sm ${
                                  isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : ''
                                }`}
                              >
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {endDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                                {isExpiringSoon && (
                                  <Badge variant="outline" className="ml-1 text-xs">
                                    Soon
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-sm flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                Ongoing
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-semibold">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">ETB</span>
                              <span>
                                {(lease.rentAmount ?? lease.terms?.rent ?? 0).toLocaleString()}
                              </span>
                              {lease.billingCycle && (
                                <Badge variant="outline" className="ml-2 text-xs capitalize">
                                  {lease.billingCycle}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                lease.status === 'active'
                                  ? 'default'
                                  : lease.status === 'expired' || lease.status === 'terminated'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className="capitalize font-medium"
                            >
                              {lease.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/org/leases/${lease._id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="View lease details"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View lease details</span>
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
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
