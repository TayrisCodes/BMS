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
import { apiGet } from '@/lib/utils/api-client';
import { ArrowLeft, UserCheck, AlertTriangle, Calendar, Phone, Car, Building2 } from 'lucide-react';
import Link from 'next/link';

interface VisitorLog {
  _id: string;
  buildingId: string;
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  hostTenantId: string;
  hostUnitId?: string | null;
  purpose: string;
  vehiclePlateNumber?: string | null;
  parkingSpaceId?: string | null;
  entryTime: string;
  exitTime?: string | null;
  loggedBy: string;
  notes?: string | null;
}

interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  reportedAt: string;
}

interface Building {
  _id: string;
  name: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

export default function VisitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [visitorLog, setVisitorLog] = useState<VisitorLog | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [linkedIncident, setLinkedIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const logData = await apiGet<VisitorLog>(`/api/visitor-logs/${id}`);

        if (!logData) {
          setError('Visitor log not found');
          return;
        }

        setVisitorLog(logData);

        // Fetch building
        if (logData.buildingId) {
          try {
            const buildingData = await apiGet<Building>(`/api/buildings/${logData.buildingId}`);
            setBuilding(buildingData);
          } catch (err) {
            console.error('Failed to fetch building', err);
          }
        }

        // Fetch tenant
        if (logData.hostTenantId) {
          try {
            const tenantData = await apiGet<Tenant>(`/api/tenants/${logData.hostTenantId}`);
            setTenant(tenantData);
          } catch (err) {
            console.error('Failed to fetch tenant', err);
          }
        }

        // Check for linked incidents
        try {
          const incidentsData = await apiGet<{ incidents: Incident[] }>(
            `/api/security/incidents?linkedVisitorLogId=${id}`,
          );
          if (incidentsData.incidents && incidentsData.incidents.length > 0) {
            setLinkedIncident(incidentsData.incidents[0]);
          }
        } catch (err) {
          console.error('Failed to fetch linked incidents', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visitor log');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchData();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!visitorLog) {
    return (
      <div className="container mx-auto py-6">
        <p>Visitor log not found</p>
      </div>
    );
  }

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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/security/visitors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{visitorLog.visitorName}</h1>
          <p className="text-muted-foreground">Visitor log details</p>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      {linkedIncident && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Linked Incident
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Link href={`/org/security/incidents/${linkedIncident.id}`}>
                  <p className="font-medium hover:underline">{linkedIncident.title}</p>
                </Link>
                <Badge variant={getSeverityBadgeVariant(linkedIncident.severity)}>
                  {linkedIncident.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Status: {linkedIncident.status} | Reported:{' '}
                {new Date(linkedIncident.reportedAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Visitor Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{visitorLog.visitorName}</p>
            </div>
            {visitorLog.visitorPhone && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </p>
                <p className="font-medium">{visitorLog.visitorPhone}</p>
              </div>
            )}
            {visitorLog.visitorIdNumber && (
              <div>
                <p className="text-sm text-muted-foreground">ID Number</p>
                <p className="font-medium">{visitorLog.visitorIdNumber}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Purpose</p>
              <p className="font-medium">{visitorLog.purpose}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Visit Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Building</p>
              <p className="font-medium">{building?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Host</p>
              <p className="font-medium">
                {tenant
                  ? `${tenant.firstName} ${tenant.lastName}`
                  : `Tenant ${visitorLog.hostTenantId.slice(-6)}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Entry Time
              </p>
              <p className="font-medium">{new Date(visitorLog.entryTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Exit Time
              </p>
              <p className="font-medium">
                {visitorLog.exitTime
                  ? new Date(visitorLog.exitTime).toLocaleString()
                  : 'Still in building'}
              </p>
            </div>
            {visitorLog.vehiclePlateNumber && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle
                </p>
                <Badge variant="outline" className="font-mono">
                  {visitorLog.vehiclePlateNumber}
                </Badge>
              </div>
            )}
            {visitorLog.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{visitorLog.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

