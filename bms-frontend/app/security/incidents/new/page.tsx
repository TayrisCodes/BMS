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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SecurityMobileLayout } from '@/lib/components/layouts/SecurityMobileLayout';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Building {
  _id: string;
  name: string;
}

export default function NewIncidentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [formData, setFormData] = useState({
    buildingId: '',
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
  });

  useEffect(() => {
    async function fetchBuildings() {
      try {
        const data = await apiGet<{ buildings: Building[] }>('/api/buildings');
        setBuildings(data.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load buildings');
      }
    }
    fetchBuildings();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        incidentType: formData.incidentType,
        severity: formData.severity,
        title: formData.title,
        description: formData.description,
        location: formData.location || null,
      };

      await apiPost('/api/security/incidents', payload);
      router.push('/security/incidents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report incident');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SecurityMobileLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/security/incidents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Report Incident</h1>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Incident Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="buildingId">Building *</Label>
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) => setFormData({ ...formData, buildingId: value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="incidentType">Type *</Label>
                  <Select
                    value={formData.incidentType}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, incidentType: value })
                    }
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[120px] px-3 py-2 border rounded-md"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description..."
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
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Link href="/security/incidents" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={
                isSubmitting || !formData.buildingId || !formData.title || !formData.description
              }
              className="flex-1"
            >
              {isSubmitting ? 'Submitting...' : 'Report Incident'}
            </Button>
          </div>
        </form>
      </div>
    </SecurityMobileLayout>
  );
}
