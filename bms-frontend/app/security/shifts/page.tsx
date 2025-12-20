'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface Shift {
  id: string;
  buildingId: string;
  securityStaffId: string;
  shiftType: 'morning' | 'afternoon' | 'night' | 'custom';
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

export default function SecurityShiftsPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function fetchShifts() {
      try {
        setLoading(true);
        const data = await apiGet<{ shifts: Shift[] }>('/api/security/shifts?active=true');
        const activeShifts = data.shifts || [];
        setActiveShift(activeShifts.length > 0 ? activeShifts[0] : null);

        const allData = await apiGet<{ shifts: Shift[] }>('/api/security/shifts?status=scheduled');
        setShifts(allData.shifts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shifts');
      } finally {
        setLoading(false);
      }
    }

    fetchShifts();
  }, []);

  async function handleCheckIn(shiftId: string) {
    setIsProcessing(true);
    try {
      const updated = await apiPost<Shift>(`/api/security/shifts/${shiftId}/check-in`, {});
      setActiveShift(updated);
      setShifts(shifts.filter((s) => s.id !== shiftId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCheckOut(shiftId: string) {
    setIsProcessing(true);
    try {
      const updated = await apiPost<Shift>(`/api/security/shifts/${shiftId}/check-out`, {});
      setActiveShift(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out');
    } finally {
      setIsProcessing(false);
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  return (
    <SecurityMobileLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Shifts</h1>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading shifts...</p>
          </div>
        ) : (
          <>
            {activeShift && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Active Shift
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Shift Type</p>
                    <Badge variant="outline">{activeShift.shiftType}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Time</p>
                    <p className="font-medium">{formatDateTime(activeShift.startTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Time</p>
                    <p className="font-medium">{formatDateTime(activeShift.endTime)}</p>
                  </div>
                  {activeShift.checkInTime && (
                    <div>
                      <p className="text-sm text-muted-foreground">Checked In</p>
                      <p className="font-medium">{formatDateTime(activeShift.checkInTime)}</p>
                    </div>
                  )}
                  {!activeShift.checkOutTime && (
                    <Button
                      onClick={() => handleCheckOut(activeShift.id)}
                      disabled={isProcessing}
                      className="w-full"
                      variant="outline"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Check Out
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {shifts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Upcoming Shifts</h2>
                {shifts.map((shift) => (
                  <Card key={shift.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{shift.shiftType}</Badge>
                          <Badge variant="secondary">{shift.status}</Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Start</p>
                          <p className="font-medium">{formatDateTime(shift.startTime)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">End</p>
                          <p className="font-medium">{formatDateTime(shift.endTime)}</p>
                        </div>
                        {shift.status === 'scheduled' && !activeShift && (
                          <Button
                            onClick={() => handleCheckIn(shift.id)}
                            disabled={isProcessing}
                            className="w-full"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Check In
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!activeShift && shifts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No shifts scheduled</p>
              </div>
            )}
          </>
        )}
      </div>
    </SecurityMobileLayout>
  );
}

