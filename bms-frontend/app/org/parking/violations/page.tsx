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
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Plus, Search, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ParkingViolation {
  _id: string;
  buildingId: string;
  parkingSpaceId?: string | null;
  vehicleId?: string | null;
  tenantId?: string | null;
  violationType:
    | 'unauthorized_parking'
    | 'expired_permit'
    | 'wrong_space'
    | 'overtime_parking'
    | 'no_permit';
  severity: 'warning' | 'fine' | 'tow';
  status: 'reported' | 'resolved' | 'appealed';
  fineAmount?: number | null;
  reportedBy: string;
  reportedAt: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  notes?: string | null;
  // Joined data
  buildingName?: string;
  spaceNumber?: string;
  vehiclePlate?: string;
  tenantName?: string;
}

interface Building {
  _id: string;
  name: string;
}

const violationTypeLabels: Record<ParkingViolation['violationType'], string> = {
  unauthorized_parking: 'Unauthorized Parking',
  expired_permit: 'Expired Permit',
  wrong_space: 'Wrong Space',
  overtime_parking: 'Overtime Parking',
  no_permit: 'No Permit',
};

const severityColors: Record<ParkingViolation['severity'], string> = {
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  fine: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  tow: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function ParkingViolationsPage() {
  const router = useRouter();
  const [violations, setViolations] = useState<ParkingViolation[]>([]);
  const [filteredViolations, setFilteredViolations] = useState<ParkingViolation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [violationsData, buildingsData] = await Promise.all([
          apiGet<{ violations: ParkingViolation[] }>('/api/parking/violations'),
          apiGet<{ buildings: Building[] }>('/api/buildings'),
        ]);
        setViolations(violationsData.violations || []);
        setFilteredViolations(violationsData.violations || []);
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load violations');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    let current = violations;

    if (buildingFilter !== 'all') {
      current = current.filter((v) => v.buildingId === buildingFilter);
    }

    if (typeFilter !== 'all') {
      current = current.filter((v) => v.violationType === typeFilter);
    }

    if (severityFilter !== 'all') {
      current = current.filter((v) => v.severity === severityFilter);
    }

    if (statusFilter !== 'all') {
      current = current.filter((v) => v.status === statusFilter);
    }

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      current = current.filter(
        (v) =>
          v.spaceNumber?.toLowerCase().includes(lowerCaseSearchTerm) ||
          v.vehiclePlate?.toLowerCase().includes(lowerCaseSearchTerm) ||
          v.tenantName?.toLowerCase().includes(lowerCaseSearchTerm) ||
          violationTypeLabels[v.violationType].toLowerCase().includes(lowerCaseSearchTerm),
      );
    }

    setFilteredViolations(current);
  }, [searchTerm, buildingFilter, typeFilter, severityFilter, statusFilter, violations]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this violation?')) {
      try {
        await apiDelete(`/api/parking/violations/${id}`);
        setViolations(violations.filter((v) => v._id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete violation');
      }
    }
  };

  return (
    <DashboardPage title="Parking Violations">
      <div className="flex justify-between items-center mb-6">
        <Link href="/org/parking/violations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Report Violation
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by space, vehicle, tenant, or type..."
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
            {buildings.map((building) => (
              <SelectItem key={building._id} value={building._id}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(violationTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="fine">Fine</SelectItem>
            <SelectItem value="tow">Tow</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="reported">Reported</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="appealed">Appealed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Space</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Fine Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reported At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">Loading violations...</p>
                </TableCell>
              </TableRow>
            ) : filteredViolations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {violations.length === 0
                      ? 'No violations reported yet.'
                      : 'No violations match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredViolations.map((violation) => (
                <TableRow key={violation._id}>
                  <TableCell>
                    <span className="text-sm">{violationTypeLabels[violation.violationType]}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={severityColors[violation.severity]}>
                      {violation.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{violation.spaceNumber || 'N/A'}</TableCell>
                  <TableCell>{violation.vehiclePlate || 'N/A'}</TableCell>
                  <TableCell>{violation.tenantName || 'N/A'}</TableCell>
                  <TableCell>
                    {violation.fineAmount ? `ETB ${violation.fineAmount.toLocaleString()}` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={violation.status === 'resolved' ? 'default' : 'secondary'}>
                      {violation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(violation.reportedAt), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/org/parking/violations/${violation._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(violation._id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}
