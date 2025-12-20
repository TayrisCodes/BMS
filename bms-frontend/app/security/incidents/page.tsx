'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';

interface Incident {
  id: string;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  status: 'reported' | 'under_investigation' | 'resolved' | 'closed';
  reportedAt: string;
}

export default function SecurityIncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIncidents() {
      try {
        setLoading(true);
        const data = await apiGet<{ incidents: Incident[] }>(
          '/api/security/incidents?status=reported,under_investigation',
        );
        setIncidents(data.incidents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incidents');
      } finally {
        setLoading(false);
      }
    }

    fetchIncidents();
  }, []);

  function getSeverityBadgeVariant(severity: string) {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  return (
    <SecurityMobileLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Incidents</h1>
          <Link href="/security/incidents/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Report
            </Button>
          </Link>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading incidents...</p>
          </div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No open incidents</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <Card
                key={incident.id}
                className="cursor-pointer"
                onClick={() => router.push(`/security/incidents/${incident.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{incident.title}</h3>
                      <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                        {incident.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{incident.incidentType}</Badge>
                      <Badge variant="secondary">{incident.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(incident.reportedAt).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SecurityMobileLayout>
  );
}

