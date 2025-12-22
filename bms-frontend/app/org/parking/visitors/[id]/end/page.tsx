'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  ArrowLeft,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Loader2,
  Receipt,
} from 'lucide-react';

interface ParkingAssignment {
  _id: string;
  parkingSpaceId: string;
  buildingId: string;
  visitorLogId: string | null;
  startDate: string;
  endDate: string | null;
  billingPeriod: 'hourly' | 'daily';
  rate: number;
  status: 'active' | 'completed' | 'cancelled';
}

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string;
  entryTime: string;
}

interface EndAssignmentResult {
  parkingAssignment: ParkingAssignment;
  calculatedAmount: number;
  invoiceGenerated: boolean;
}

export default function EndVisitorParkingPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<ParkingAssignment | null>(null);
  const [visitorLog, setVisitorLog] = useState<VisitorLog | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [duration, setDuration] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssignment() {
      try {
        setIsLoading(true);
        setError(null);

        const assignmentData = await apiGet<{ parkingAssignment: ParkingAssignment }>(
          `/api/parking/assignments/${assignmentId}`,
        );
        setAssignment(assignmentData.parkingAssignment);

        // Fetch visitor log if available
        if (assignmentData.parkingAssignment.visitorLogId) {
          try {
            const visitorData = await apiGet<{ visitorLog: VisitorLog }>(
              `/api/visitor-logs/${assignmentData.parkingAssignment.visitorLogId}`,
            );
            setVisitorLog(visitorData.visitorLog);
          } catch (err) {
            console.warn('Failed to fetch visitor log:', err);
          }
        }

        // Calculate current duration and amount
        if (assignmentData.parkingAssignment.status === 'active') {
          const start = new Date(assignmentData.parkingAssignment.startDate);
          const end = new Date();
          const diffMs = end.getTime() - start.getTime();
          const hours = Math.ceil(diffMs / (1000 * 60 * 60));
          const days = Math.ceil(hours / 24);

          let calculated = 0;
          if (assignmentData.parkingAssignment.billingPeriod === 'hourly') {
            calculated = hours * assignmentData.parkingAssignment.rate;
            setDuration(`${hours} hour${hours !== 1 ? 's' : ''}`);
          } else {
            calculated = days * assignmentData.parkingAssignment.rate;
            setDuration(`${days} day${days !== 1 ? 's' : ''}`);
          }

          setCalculatedAmount(calculated);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assignment');
      } finally {
        setIsLoading(false);
      }
    }

    if (assignmentId) {
      fetchAssignment();
    }
  }, [assignmentId]);

  async function handleEndAssignment() {
    if (!assignment) return;

    setIsEnding(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiPost<EndAssignmentResult>(
        `/api/parking/assignments/${assignmentId}/end`,
        {
          generateInvoice: true,
        },
      );

      setSuccess(
        result.invoiceGenerated
          ? 'Parking assignment ended and invoice generated successfully!'
          : 'Parking assignment ended successfully!',
      );
      setCalculatedAmount(result.calculatedAmount);
      setAssignment(result.parkingAssignment);

      setTimeout(() => {
        router.push(`/org/parking/assignments/${assignmentId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end parking assignment');
    } finally {
      setIsEnding(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-ET', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="End Visitor Parking"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Visitor Parking', href: '/org/parking/visitors' },
          { label: 'End Assignment', href: '#' },
        ]}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading assignment...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (error && !assignment) {
    return (
      <DashboardPage
        title="End Visitor Parking"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Visitor Parking', href: '/org/parking/visitors' },
          { label: 'End Assignment', href: '#' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Assignment Not Found</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => router.push('/org/parking/visitors')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Visitor Parking
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  if (!assignment || assignment.status !== 'active') {
    return (
      <DashboardPage
        title="End Visitor Parking"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Visitor Parking', href: '/org/parking/visitors' },
          { label: 'End Assignment', href: '#' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Assignment Already Ended</h3>
                <p className="text-muted-foreground mb-4">
                  This parking assignment has already been completed or cancelled.
                </p>
                <Button onClick={() => router.push(`/org/parking/assignments/${assignmentId}`)}>
                  View Assignment Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="End Visitor Parking"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Visitor Parking', href: '/org/parking/visitors' },
        { label: 'End Assignment', href: '#' },
      ]}
    >
      <div className="col-span-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/org/parking/visitors')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">End Visitor Parking</h2>
            <p className="text-sm text-muted-foreground">
              End parking assignment and generate invoice
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Assignment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Visitor</p>
                <p className="font-medium">{visitorLog?.visitorName || 'Unknown Visitor'}</p>
                {visitorLog?.visitorPhone && (
                  <p className="text-sm text-muted-foreground">{visitorLog.visitorPhone}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Entry Time</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{formatDate(assignment.startDate)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Current Time</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{formatDate(new Date().toISOString())}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Duration</p>
                <p className="font-medium">{duration}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Rate</p>
                <p className="font-medium">
                  {formatCurrency(assignment.rate)} / {assignment.billingPeriod}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-4 border-b">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-medium">{duration}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="text-lg font-medium">
                  {formatCurrency(assignment.rate)} / {assignment.billingPeriod}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <p className="text-lg font-semibold">Total Amount</p>
              </div>
              <p className="text-3xl font-bold text-primary">{formatCurrency(calculatedAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/org/parking/visitors')}
            disabled={isEnding}
          >
            Cancel
          </Button>
          <Button onClick={handleEndAssignment} disabled={isEnding}>
            {isEnding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Ending Assignment...
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                End Assignment & Generate Invoice
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardPage>
  );
}
