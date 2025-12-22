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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet, apiPut } from '@/lib/utils/api-client';
import { ArrowLeft, AlertTriangle, Edit, Save, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Incident {
  id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location?: string | null;
  reportedBy: string;
  reportedAt: string;
  involvedParties?: Array<{
    name: string;
    role: 'tenant' | 'visitor' | 'staff' | 'unknown';
    contactInfo?: string | null;
  }> | null;
  status: 'reported' | 'under_investigation' | 'resolved' | 'closed';
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  photos?: string[] | null;
  documents?: string[] | null;
  linkedVisitorLogId?: string | null;
  linkedComplaintId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function IncidentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    status: 'reported' as 'reported' | 'under_investigation' | 'resolved' | 'closed',
    resolutionNotes: '',
  });

  useEffect(() => {
    async function fetchIncident() {
      try {
        setIsLoading(true);
        const data = await apiGet<Incident>(`/api/security/incidents/${id}`);
        setIncident(data);
        setFormData({
          status: data.status,
          resolutionNotes: data.resolutionNotes || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incident');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchIncident();
    }
  }, [id]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const payload: any = {
        status: formData.status,
      };

      if (formData.status === 'resolved' || formData.status === 'closed') {
        payload.resolutionNotes = formData.resolutionNotes || null;
      }

      const updated = await apiPut<Incident>(`/api/security/incidents/${id}`, payload);
      setIncident(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident');
    } finally {
      setIsSaving(false);
    }
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

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case 'closed':
        return 'secondary';
      case 'resolved':
        return 'default';
      case 'under_investigation':
        return 'default';
      case 'reported':
        return 'outline';
      default:
        return 'outline';
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="container mx-auto py-6">
        <p>Incident not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/security/incidents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{incident.title}</h1>
          <p className="text-muted-foreground">Incident details and management</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incident Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline">{incident.incidentType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Severity</p>
              <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                {incident.severity}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {isEditing ? (
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="under_investigation">Under Investigation</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={getStatusBadgeVariant(incident.status)}>{incident.status}</Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-sm">{incident.location || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reported At</p>
              <p className="text-sm">{new Date(incident.reportedAt).toLocaleString()}</p>
            </div>
            {incident.resolvedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Resolved At</p>
                <p className="text-sm">{new Date(incident.resolvedAt).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
          </CardContent>
        </Card>

        {incident.involvedParties && incident.involvedParties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Involved Parties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {incident.involvedParties.map((party, index) => (
                  <div key={index} className="p-2 border rounded">
                    <p className="font-medium">{party.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Role: {party.role}
                      {party.contactInfo && ` - ${party.contactInfo}`}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {incident.photos && incident.photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {incident.photos.map((photo, index) => (
                  <div key={index} className="relative w-full h-32 rounded overflow-hidden">
                    <Image
                      src={photo}
                      alt={`Incident photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="50vw"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(incident.status === 'resolved' || incident.status === 'closed') && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Resolution</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Resolution Notes</label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    value={formData.resolutionNotes}
                    onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
                    placeholder="Enter resolution notes..."
                  />
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {incident.resolutionNotes || 'No resolution notes'}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {isEditing && (
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
