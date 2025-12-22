'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

interface VisitorLog {
  _id: string;
  visitorName: string;
  entryTime: string;
}

export default function NewIncidentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [formData, setFormData] = useState({
    buildingId: '',
    unitId: '',
    incidentType: 'other' as
      | 'theft'
      | 'vandalism'
      | 'trespassing'
      | 'violence'
      | 'suspicious_activity'
      | 'fire'
      | 'medical'
      | 'other',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    title: '',
    description: '',
    location: '',
    linkedVisitorLogId: '',
    involvedParties: [] as Array<{
      name: string;
      role: 'tenant' | 'visitor' | 'staff' | 'unknown';
      contactInfo?: string;
    }>,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const buildingsData = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchUnits() {
      if (!formData.buildingId) {
        setUnits([]);
        return;
      }

      try {
        const unitsData = await apiGet<{ units: Unit[] }>(
          `/api/units?buildingId=${formData.buildingId}`,
        );
        setUnits(unitsData.units || []);
      } catch (err) {
        console.error('Failed to fetch units', err);
      }
    }

    fetchUnits();
  }, [formData.buildingId]);

  useEffect(() => {
    async function fetchVisitorLogs() {
      if (!formData.buildingId) {
        setVisitorLogs([]);
        return;
      }

      try {
        const logsData = await apiGet<{ logs: VisitorLog[] }>(
          `/api/visitor-logs?buildingId=${formData.buildingId}&limit=50`,
        );
        setVisitorLogs(logsData.logs || []);
      } catch (err) {
        console.error('Failed to fetch visitor logs', err);
      }
    }

    fetchVisitorLogs();
  }, [formData.buildingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        unitId: formData.unitId || null,
        incidentType: formData.incidentType,
        severity: formData.severity,
        title: formData.title,
        description: formData.description,
        location: formData.location || null,
        linkedVisitorLogId: formData.linkedVisitorLogId || null,
        involvedParties: formData.involvedParties.length > 0 ? formData.involvedParties : null,
      };

      await apiPost('/api/security/incidents', payload);
      router.push('/org/security/incidents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident');
    } finally {
      setIsSubmitting(false);
    }
  }

  function addInvolvedParty() {
    setFormData({
      ...formData,
      involvedParties: [
        ...formData.involvedParties,
        { name: '', role: 'unknown', contactInfo: '' },
      ],
    });
  }

  function updateInvolvedParty(index: number, field: string, value: string) {
    const updated = [...formData.involvedParties];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, involvedParties: updated });
  }

  function removeInvolvedParty(index: number) {
    setFormData({
      ...formData,
      involvedParties: formData.involvedParties.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/security/incidents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Report Security Incident</h1>
          <p className="text-muted-foreground">Create a new security incident report</p>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incident Information
            </CardTitle>
            <CardDescription>Provide details about the security incident</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buildingId">Building *</Label>
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, buildingId: value, unitId: '' })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitId">Unit</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                  disabled={!formData.buildingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit._id} value={unit._id}>
                        {unit.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="incidentType">Incident Type *</Label>
                <Select
                  value={formData.incidentType}
                  onValueChange={(value: any) => setFormData({ ...formData, incidentType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theft">Theft</SelectItem>
                    <SelectItem value="vandalism">Vandalism</SelectItem>
                    <SelectItem value="trespassing">Trespassing</SelectItem>
                    <SelectItem value="violence">Violence</SelectItem>
                    <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                    <SelectItem value="fire">Fire</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity">Severity *</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: any) => setFormData({ ...formData, severity: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the incident"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[150px] px-3 py-2 border rounded-md"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of what happened..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Specific location within building"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedVisitorLogId">Linked Visitor Log</Label>
                <Select
                  value={formData.linkedVisitorLogId}
                  onValueChange={(value) => setFormData({ ...formData, linkedVisitorLogId: value })}
                  disabled={!formData.buildingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visitor log (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {visitorLogs.map((log) => (
                      <SelectItem key={log._id} value={log._id}>
                        {log.visitorName} - {new Date(log.entryTime).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Involved Parties</Label>
                <Button type="button" variant="outline" size="sm" onClick={addInvolvedParty}>
                  Add Party
                </Button>
              </div>
              {formData.involvedParties.map((party, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2 border rounded"
                >
                  <Input
                    placeholder="Name"
                    value={party.name}
                    onChange={(e) => updateInvolvedParty(index, 'name', e.target.value)}
                  />
                  <Select
                    value={party.role}
                    onValueChange={(value: any) => updateInvolvedParty(index, 'role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="visitor">Visitor</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Contact info"
                    value={party.contactInfo || ''}
                    onChange={(e) => updateInvolvedParty(index, 'contactInfo', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInvolvedParty(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/org/security/incidents">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={
              isSubmitting || !formData.buildingId || !formData.title || !formData.description
            }
          >
            {isSubmitting ? 'Submitting...' : 'Report Incident'}
          </Button>
        </div>
      </form>
    </div>
  );
}
