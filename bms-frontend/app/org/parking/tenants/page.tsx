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
import { Input } from '@/lib/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  Car,
  Plus,
  Search,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';

interface ParkingAssignment {
  _id: string;
  parkingSpaceId: string;
  buildingId: string;
  assignmentType: 'tenant' | 'visitor';
  tenantId: string | null;
  vehicleId: string | null;
  startDate: string;
  endDate: string | null;
  billingPeriod: 'monthly' | 'daily' | 'hourly';
  rate: number;
  invoiceId: string | null;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  spaceType: string;
}

interface Building {
  _id: string;
  name: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
}

interface Vehicle {
  _id: string;
  plateNumber: string;
  make?: string;
  model?: string;
}

export default function TenantParkingPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<ParkingAssignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<ParkingAssignment[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<Record<string, ParkingSpace>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [tenants, setTenants] = useState<Record<string, Tenant>>({});
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch tenant parking assignments
        const assignmentsData = await apiGet<{ parkingAssignments: ParkingAssignment[] }>(
          '/api/parking/assignments?type=tenant',
        );
        setAssignments(assignmentsData.parkingAssignments || []);
        setFilteredAssignments(assignmentsData.parkingAssignments || []);

        // Fetch related data
        const [spacesData, buildingsData, tenantsData, vehiclesData] = await Promise.all([
          apiGet<{ parkingSpaces: ParkingSpace[] }>('/api/parking-spaces').catch(() => ({
            parkingSpaces: [],
          })),
          apiGet<{ buildings: Building[] }>('/api/buildings').catch(() => ({ buildings: [] })),
          apiGet<{ tenants: Tenant[] }>('/api/tenants').catch(() => ({ tenants: [] })),
          apiGet<{ vehicles: Vehicle[] }>('/api/vehicles').catch(() => ({ vehicles: [] })),
        ]);

        const spacesMap: Record<string, ParkingSpace> = {};
        (spacesData.parkingSpaces || []).forEach((space) => {
          spacesMap[space._id] = space;
        });
        setParkingSpaces(spacesMap);

        const buildingsMap: Record<string, Building> = {};
        (buildingsData.buildings || []).forEach((building) => {
          buildingsMap[building._id] = building;
        });
        setBuildings(buildingsMap);

        const tenantsMap: Record<string, Tenant> = {};
        (tenantsData.tenants || []).forEach((tenant) => {
          tenantsMap[tenant._id] = tenant;
        });
        setTenants(tenantsMap);

        const vehiclesMap: Record<string, Vehicle> = {};
        (vehiclesData.vehicles || []).forEach((vehicle) => {
          vehiclesMap[vehicle._id] = vehicle;
        });
        setVehicles(vehiclesMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = assignments;

    // Apply building filter
    if (buildingFilter !== 'all') {
      filtered = filtered.filter((a) => a.buildingId === buildingFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((a) => {
        const tenant = a.tenantId ? tenants[a.tenantId] : null;
        const space = parkingSpaces[a.parkingSpaceId];
        const building = buildings[a.buildingId];
        const vehicle = a.vehicleId ? vehicles[a.vehicleId] : null;

        return (
          tenant?.firstName.toLowerCase().includes(searchLower) ||
          tenant?.lastName.toLowerCase().includes(searchLower) ||
          tenant?.primaryPhone?.toLowerCase().includes(searchLower) ||
          space?.spaceNumber.toLowerCase().includes(searchLower) ||
          building?.name.toLowerCase().includes(searchLower) ||
          vehicle?.plateNumber.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by start date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });

    setFilteredAssignments(filtered);
  }, [
    searchTerm,
    buildingFilter,
    statusFilter,
    assignments,
    parkingSpaces,
    buildings,
    tenants,
    vehicles,
  ]);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getNextBillingDate(startDate: string): string {
    const start = new Date(startDate);
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    return formatDate(next.toISOString());
  }

  const availableBuildings = Object.values(buildings);

  return (
    <DashboardPage
      title="Tenant Parking"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Tenant Parking', href: '/org/parking/tenants' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Car className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Tenant Parking</h2>
              <p className="text-sm text-muted-foreground">
                Manage monthly parking assignments for tenants
              </p>
            </div>
          </div>
          <Link href="/org/parking/tenants/assign">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Assign Parking
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by tenant name, phone, space number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {availableBuildings.map((building) => (
                <SelectItem key={building._id} value={building._id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Parking Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading assignments...</p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="text-center py-8">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {assignments.length === 0
                    ? 'No tenant parking assignments found. Assign parking to a tenant to get started.'
                    : 'No assignments match your filters.'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Parking Space</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Next Billing</TableHead>
                      <TableHead>Monthly Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => {
                      const tenant = assignment.tenantId ? tenants[assignment.tenantId] : null;
                      const space = parkingSpaces[assignment.parkingSpaceId];
                      const building = buildings[assignment.buildingId];
                      const vehicle = assignment.vehicleId ? vehicles[assignment.vehicleId] : null;

                      return (
                        <TableRow key={assignment._id}>
                          <TableCell className="font-medium">
                            {tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Unknown Tenant'}
                            {tenant?.primaryPhone && (
                              <div className="text-xs text-muted-foreground">
                                {tenant.primaryPhone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{space?.spaceNumber || 'Unknown'}</TableCell>
                          <TableCell>{building?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            {vehicle ? (
                              <div>
                                <div className="font-medium">{vehicle.plateNumber}</div>
                                {vehicle.make && vehicle.model && (
                                  <div className="text-xs text-muted-foreground">
                                    {vehicle.make} {vehicle.model}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(assignment.startDate)}</TableCell>
                          <TableCell>
                            {assignment.status === 'active' &&
                            assignment.billingPeriod === 'monthly'
                              ? getNextBillingDate(assignment.startDate)
                              : '—'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(assignment.rate)}
                          </TableCell>
                          <TableCell>
                            {assignment.status === 'active' ? (
                              <Badge variant="default" className="flex items-center gap-1 w-fit">
                                <CheckCircle className="h-3 w-3" />
                                Active
                              </Badge>
                            ) : assignment.status === 'completed' ? (
                              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                <Clock className="h-3 w-3" />
                                Completed
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="flex items-center gap-1 w-fit"
                              >
                                <XCircle className="h-3 w-3" />
                                Cancelled
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/org/parking/assignments/${assignment._id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
