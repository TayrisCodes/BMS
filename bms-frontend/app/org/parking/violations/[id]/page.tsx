'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPut } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { AlertTriangle, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

interface ParkingViolation {
  _id: string;
  buildingId: string;
  parkingSpaceId?: string | null;
  vehicleId?: string | null;
  tenantId?: string | null;
  violationType: string;
  severity: 'warning' | 'fine' | 'tow';
  status: 'reported' | 'resolved' | 'appealed';
  fineAmount?: number | null;
  reportedBy: string;
  reportedAt: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  photos?: string[] | null;
  notes?: string | null;
  // Joined data
  buildingName?: string;
  spaceNumber?: string;
  vehiclePlate?: string;
  tenantName?: string;
  reportedByName?: string;
  resolvedByName?: string;
}

const severityColors: Record<string, string> = {
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  fine: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  tow: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function ViolationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [violation, setViolation] = useState<ParkingViolation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    async function fetchViolation() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ violation: ParkingViolation }>(
          `/api/parking/violations/${params.id}`,
        );
        setViolation(data.violation);
        setResolutionNotes(data.violation.resolutionNotes || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load violation');
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) {
      fetchViolation();
    }
  }, [params.id]);

  async function handleResolve() {
    if (!violation) return;

    setIsResolving(true);
    try {
      const updated = await apiPut<{ violation: ParkingViolation }>(
        `/api/parking/violations/${violation._id}`,
        {
          status: 'resolved',
          resolutionNotes: resolutionNotes || null,
        },
      );
      setViolation(updated.violation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve violation');
    } finally {
      setIsResolving(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage title="Violation Details">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading violation details...</p>
        </div>
      </DashboardPage>
    );
  }

  if (!violation) {
    return (
      <DashboardPage title="Violation Details">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Violation not found</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title="Violation Details">
      <div className="col-span-full space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/org/parking/violations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Violation Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium capitalize">
                  {violation.violationType.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Severity</p>
                <Badge className={severityColors[violation.severity]}>{violation.severity}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={violation.status === 'resolved' ? 'default' : 'secondary'}>
                  {violation.status}
                </Badge>
              </div>
              {violation.fineAmount && (
                <div>
                  <p className="text-sm text-muted-foreground">Fine Amount</p>
                  <p className="font-medium">ETB {violation.fineAmount.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Building</p>
                <p className="font-medium">{violation.buildingName || 'N/A'}</p>
              </div>
              {violation.spaceNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">Parking Space</p>
                  <p className="font-medium">{violation.spaceNumber}</p>
                </div>
              )}
              {violation.vehiclePlate && (
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-medium">{violation.vehiclePlate}</p>
                </div>
              )}
              {violation.tenantName && (
                <div>
                  <p className="text-sm text-muted-foreground">Tenant</p>
                  <p className="font-medium">{violation.tenantName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Reported At</p>
                <p className="font-medium">
                  {format(new Date(violation.reportedAt), 'MMM dd, yyyy HH:mm')}
                </p>
                {violation.reportedByName && (
                  <p className="text-sm text-muted-foreground">by {violation.reportedByName}</p>
                )}
              </div>
              {violation.resolvedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Resolved At</p>
                  <p className="font-medium">
                    {format(new Date(violation.resolvedAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                  {violation.resolvedByName && (
                    <p className="text-sm text-muted-foreground">by {violation.resolvedByName}</p>
                  )}
                </div>
              )}
              {violation.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{violation.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {violation.status !== 'resolved' && (
          <Card>
            <CardHeader>
              <CardTitle>Resolve Violation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution Notes</label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Enter resolution details..."
                />
              </div>
              <Button onClick={handleResolve} disabled={isResolving}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {isResolving ? 'Resolving...' : 'Mark as Resolved'}
              </Button>
            </CardContent>
          </Card>
        )}

        {violation.resolutionNotes && (
          <Card>
            <CardHeader>
              <CardTitle>Resolution Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{violation.resolutionNotes}</p>
            </CardContent>
          </Card>
        )}

        {violation.photos && violation.photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {violation.photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative w-full h-32 rounded-lg border overflow-hidden"
                  >
                    <Image
                      src={photo}
                      alt={`Violation photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardPage>
  );
}
