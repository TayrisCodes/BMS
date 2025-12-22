'use client';

import { useEffect, useState } from 'react';
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
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string | null;
  entryTime: string;
  buildingId: string;
}

interface Building {
  _id: string;
  name: string;
}

export default function VisitorAccessPage() {
  const router = useRouter();
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    buildingId: '',
    visitorLogId: '',
    accessLevel: 'restricted' as 'full' | 'restricted' | 'denied',
    validFrom: '',
    validUntil: '',
    notes: '',
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

  useEffect(() => {
    async function fetchVisitorLogs() {
      if (!selectedBuilding) {
        setVisitorLogs([]);
        return;
      }

      try {
        const data = await apiGet<{ logs: VisitorLog[] }>(
          `/api/visitor-logs?buildingId=${selectedBuilding}&limit=100`,
        );
        setVisitorLogs(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch visitor logs', err);
      }
    }

    fetchVisitorLogs();
  }, [selectedBuilding]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        entityType: 'visitor',
        entityId: formData.visitorLogId,
        accessLevel: formData.accessLevel,
        validFrom: formData.validFrom || null,
        validUntil: formData.validUntil || null,
        notes: formData.notes || null,
      };

      await apiPost('/api/security/access-control', payload);
      router.push('/org/security/access-control');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create access permission');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardPage title="Manage Visitor Access">
      <div className="col-span-full space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/org/security/access-control">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Create Visitor Access Permission</CardTitle>
            <CardDescription>Grant or restrict access for a visitor</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buildingId">Building *</Label>
                  <Select
                    value={formData.buildingId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, buildingId: value, visitorLogId: '' });
                      setSelectedBuilding(value);
                    }}
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
                  <Label htmlFor="visitorLogId">Visitor *</Label>
                  <Select
                    value={formData.visitorLogId}
                    onValueChange={(value) => setFormData({ ...formData, visitorLogId: value })}
                    required
                    disabled={!selectedBuilding}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select visitor" />
                    </SelectTrigger>
                    <SelectContent>
                      {visitorLogs.map((log) => (
                        <SelectItem key={log._id} value={log._id}>
                          {log.visitorName} {log.visitorPhone && `(${log.visitorPhone})`} -{' '}
                          {new Date(log.entryTime).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessLevel">Access Level *</Label>
                  <Select
                    value={formData.accessLevel}
                    onValueChange={(value: any) => setFormData({ ...formData, accessLevel: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Access</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validFrom">Valid From</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/org/security/access-control">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.buildingId || !formData.visitorLogId}
                >
                  {isSubmitting ? 'Creating...' : 'Create Permission'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
