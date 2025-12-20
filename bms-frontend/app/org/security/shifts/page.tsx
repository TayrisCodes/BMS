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
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Clock, Plus, Calendar, Filter } from 'lucide-react';

interface Shift {
  id: string;
  organizationId: string;
  buildingId: string;
  securityStaffId: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'custom';
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  createdBy: string;
  createdAt: string;
}

export default function ShiftsPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftTypeFilter, setShiftTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchShifts() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ shifts: Shift[] }>('/api/security/shifts');
        setShifts(data.shifts || []);
        setFilteredShifts(data.shifts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shifts');
      } finally {
        setIsLoading(false);
      }
    }

    fetchShifts();
  }, []);

  useEffect(() => {
    let filtered = shifts;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (shiftTypeFilter !== 'all') {
      filtered = filtered.filter((s) => s.shiftType === shiftTypeFilter);
    }

    setFilteredShifts(filtered);
  }, [statusFilter, shiftTypeFilter, shifts]);

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      case 'scheduled':
        return 'outline';
      default:
        return 'outline';
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  return (
    <DashboardPage
      title="Shift Schedule"
      description="View and manage security staff shifts"
      icon={<Clock className="h-5 w-5" />}
    >
      <div className="col-span-full flex justify-between items-center">
        <div className="flex gap-2">
          <Link href="/org/security/shifts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Shift
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={shiftTypeFilter} onValueChange={setShiftTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="afternoon">Afternoon</SelectItem>
            <SelectItem value="night">Night</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift Type</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check-In</TableHead>
              <TableHead>Check-Out</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading shifts...</p>
                </TableCell>
              </TableRow>
            ) : filteredShifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {shifts.length === 0
                      ? 'No shifts found. Create your first shift.'
                      : 'No shifts match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredShifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    <Badge variant="outline">{shift.shiftType}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(shift.startTime)}</TableCell>
                  <TableCell>{formatDateTime(shift.endTime)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(shift.status)}>{shift.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {shift.checkInTime ? formatDateTime(shift.checkInTime) : 'Not checked in'}
                  </TableCell>
                  <TableCell>
                    {shift.checkOutTime ? formatDateTime(shift.checkOutTime) : 'Not checked out'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/org/security/shifts/${shift.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
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

