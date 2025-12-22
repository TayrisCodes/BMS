'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

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

export default function ShiftDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchShift() {
      try {
        setIsLoading(true);
        const data = await apiGet<Shift>(`/api/security/shifts/${id}`);
        setShift(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shift');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchShift();
    }
  }, [id]);

  async function handleCheckIn() {
    setIsProcessing(true);
    setError(null);

    try {
      const updated = await apiPost<Shift>(`/api/security/shifts/${id}/check-in`, {});
      setShift(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCheckOut() {
    setIsProcessing(true);
    setError(null);

    try {
      const updated = await apiPost<Shift>(`/api/security/shifts/${id}/check-out`, {});
      setShift(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out');
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="container mx-auto py-6">
        <p>Shift not found</p>
      </div>
    );
  }

  const canCheckIn = shift.status === 'scheduled' && !shift.checkInTime;
  const canCheckOut = shift.status === 'active' && shift.checkInTime && !shift.checkOutTime;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/security/shifts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Shift Details</h1>
          <p className="text-muted-foreground">View and manage shift information</p>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Shift Type</p>
              <Badge variant="outline">{shift.shiftType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={
                  shift.status === 'active'
                    ? 'default'
                    : shift.status === 'completed'
                      ? 'secondary'
                      : shift.status === 'cancelled'
                        ? 'destructive'
                        : 'outline'
                }
              >
                {shift.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Time</p>
              <p className="font-medium">{new Date(shift.startTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Time</p>
              <p className="font-medium">{new Date(shift.endTime).toLocaleString()}</p>
            </div>
            {shift.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{shift.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Check-In/Check-Out</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Check-In Time</p>
              <p className="font-medium">
                {shift.checkInTime
                  ? new Date(shift.checkInTime).toLocaleString()
                  : 'Not checked in'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check-Out Time</p>
              <p className="font-medium">
                {shift.checkOutTime
                  ? new Date(shift.checkOutTime).toLocaleString()
                  : 'Not checked out'}
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              {canCheckIn && (
                <Button onClick={handleCheckIn} disabled={isProcessing} className="flex-1">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              )}
              {canCheckOut && (
                <Button
                  onClick={handleCheckOut}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
