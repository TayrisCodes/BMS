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
  UserCheck,
  Plus,
  Search,
  Eye,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';

interface ParkingAssignment {
  _id: string;
  parkingSpaceId: string;
  buildingId: string;
  assignmentType: 'tenant' | 'visitor';
  visitorLogId: string | null;
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

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string;
  entryTime: string;
  exitTime?: string | null;
}

export default function VisitorParkingPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<ParkingAssignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<ParkingAssignment[]>([]);
  const [parkingSpaces, setParkingSpaces] = useState<Record<string, ParkingSpace>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [visitorLogs, setVisitorLogs] = useState<Record<string, VisitorLog>>({});
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

        // Fetch visitor parking assignments
        const assignmentsData = await apiGet<{ parkingAssignments: ParkingAssignment[] }>(
          '/api/parking/assignments?type=visitor',
        );
        setAssignments(assignmentsData.parkingAssignments || []);
        setFilteredAssignments(assignmentsData.parkingAssignments || []);

        // Fetch related data
        const [spacesData, buildingsData, visitorLogsData] = await Promise.all([
          apiGet<{ parkingSpaces: ParkingSpace[] }>('/api/parking-spaces').catch(() => ({
            parkingSpaces: [],
          })),
          apiGet<{ buildings: Building[] }>('/api/buildings').catch(() => ({ buildings: [] })),
          apiGet<{ visitorLogs: VisitorLog[] }>('/api/visitor-logs').catch(() => ({
            visitorLogs: [],
          })),
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

        const visitorLogsMap: Record<string, VisitorLog> = {};
        (visitorLogsData.visitorLogs || []).forEach((log) => {
          visitorLogsMap[log._id] = log;
        });
        setVisitorLogs(visitorLogsMap);
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
        const visitor = a.visitorLogId ? visitorLogs[a.visitorLogId] : null;
        const space = parkingSpaces[a.parkingSpaceId];
        const building = buildings[a.buildingId];

        return (
          visitor?.visitorName.toLowerCase().includes(searchLower) ||
          visitor?.visitorPhone?.toLowerCase().includes(searchLower) ||
          space?.spaceNumber.toLowerCase().includes(searchLower) ||
          building?.name.toLowerCase().includes(searchLower)
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
    visitorLogs,
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
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function calculateDuration(startDate: string, endDate: string | null): string {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  const availableBuildings = Object.values(buildings);

  return (
    <DashboardPage
      title="Visitor Parking"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Visitor Parking', href: '/org/parking/visitors' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Visitor Parking</h2>
              <p className="text-sm text-muted-foreground">
                Manage hourly and daily parking assignments for visitors
              </p>
            </div>
          </div>
          <Link href="/org/parking/visitors/assign">
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
              placeholder="Search by visitor name, phone, space number..."
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
                <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {assignments.length === 0
                    ? 'No visitor parking assignments found. Assign parking to a visitor to get started.'
                    : 'No assignments match your filters.'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visitor</TableHead>
                      <TableHead>Parking Space</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Entry Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => {
                      const visitor = assignment.visitorLogId
                        ? visitorLogs[assignment.visitorLogId]
                        : null;
                      const space = parkingSpaces[assignment.parkingSpaceId];
                      const building = buildings[assignment.buildingId];

                      return (
                        <TableRow key={assignment._id}>
                          <TableCell className="font-medium">
                            {visitor ? (
                              <div>
                                <div>{visitor.visitorName}</div>
                                {visitor.visitorPhone && (
                                  <div className="text-xs text-muted-foreground">
                                    {visitor.visitorPhone}
                                  </div>
                                )}
                              </div>
                            ) : (
                              'Unknown Visitor'
                            )}
                          </TableCell>
                          <TableCell>{space?.spaceNumber || 'Unknown'}</TableCell>
                          <TableCell>{building?.name || 'Unknown'}</TableCell>
                          <TableCell>{formatDate(assignment.startDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {calculateDuration(assignment.startDate, assignment.endDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold">{formatCurrency(assignment.rate)}</div>
                              <div className="text-xs text-muted-foreground">
                                /{assignment.billingPeriod}
                              </div>
                            </div>
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
                            {assignment.status === 'active' ? (
                              <Link href={`/org/parking/visitors/${assignment._id}/end`}>
                                <Button variant="outline" size="sm">
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  End
                                </Button>
                              </Link>
                            ) : (
                              <Link href={`/org/parking/assignments/${assignment._id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
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
