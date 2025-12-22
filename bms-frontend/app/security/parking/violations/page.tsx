'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { Plus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ParkingViolation {
  _id: string;
  violationType: string;
  severity: 'warning' | 'fine' | 'tow';
  status: 'reported' | 'resolved' | 'appealed';
  fineAmount?: number | null;
  reportedAt: string;
  notes?: string | null;
  spaceNumber?: string;
  vehiclePlate?: string;
}

const severityColors: Record<string, string> = {
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  fine: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  tow: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function SecurityParkingViolationsPage() {
  const router = useRouter();
  const [violations, setViolations] = useState<ParkingViolation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchViolations() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ violations: ParkingViolation[] }>('/api/parking/violations');
        setViolations(data.violations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load violations');
      } finally {
        setIsLoading(false);
      }
    }

    fetchViolations();
  }, []);

  return (
    <SecurityMobileLayout title="Parking Violations">
      <div className="space-y-4 p-4">
        <Link href="/security/parking/report-violation">
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Report New Violation
          </Button>
        </Link>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading violations...</p>
          </div>
        ) : violations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No violations reported today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {violations.slice(0, 20).map((violation) => (
              <Card key={violation._id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium capitalize">
                        {violation.violationType.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(violation.reportedAt), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    <Badge className={severityColors[violation.severity]}>
                      {violation.severity}
                    </Badge>
                  </div>
                  {violation.spaceNumber && (
                    <p className="text-sm">Space: {violation.spaceNumber}</p>
                  )}
                  {violation.vehiclePlate && (
                    <p className="text-sm">Vehicle: {violation.vehiclePlate}</p>
                  )}
                  {violation.fineAmount && (
                    <p className="text-sm font-medium">
                      Fine: ETB {violation.fineAmount.toLocaleString()}
                    </p>
                  )}
                  {violation.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{violation.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SecurityMobileLayout>
  );
}
