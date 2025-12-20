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
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Bell, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  floor: number;
}

export default function NewNoticePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [formData, setFormData] = useState({
    buildingId: '',
    title: '',
    content: '',
    type: 'announcement' as 'announcement' | 'emergency' | 'maintenance' | 'general',
    priority: 'normal' as 'normal' | 'high' | 'urgent',
    audience: 'all' as 'all' | 'building' | 'floor' | 'unit' | 'tenant_type',
    floor: '',
    unitId: '',
    tenantType: 'residential' as 'residential' | 'commercial' | null,
    expiryDate: '',
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
    async function fetchUnits() {
      if (!formData.buildingId) {
        setUnits([]);
        return;
      }

      try {
        const data = await apiGet<{ units: Unit[] }>(
          `/api/units?buildingId=${formData.buildingId}`,
        );
        setUnits(data.units || []);
      } catch (err) {
        console.error('Failed to fetch units', err);
      }
    }

    fetchUnits();
  }, [formData.buildingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const targeting = {
        audience: formData.audience,
        buildingId: formData.buildingId || null,
        floor: formData.floor ? parseInt(formData.floor) : null,
        unitId: formData.unitId || null,
        tenantType: formData.tenantType,
      };

      const payload = {
        buildingId: formData.buildingId || null,
        title: formData.title,
        content: formData.content,
        type: formData.type,
        priority: formData.priority,
        targeting,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
      };

      await apiPost('/api/notices', payload);
      router.push('/org/notices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create notice');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardPage
      title="Create Notice"
      description="Create a new building notice or announcement"
      icon={<Bell className="h-5 w-5" />}
    >
      <div className="col-span-full space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/org/notices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Notice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buildingId">Building</Label>
                  <Select
                    value={formData.buildingId}
                    onValueChange={(value) => setFormData({ ...formData, buildingId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select building (optional)" />
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
                  <Label htmlFor="audience">Target Audience *</Label>
                  <Select
                    value={formData.audience}
                    onValueChange={(value: any) => setFormData({ ...formData, audience: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tenants</SelectItem>
                      <SelectItem value="building">Specific Building</SelectItem>
                      <SelectItem value="floor">Specific Floor</SelectItem>
                      <SelectItem value="unit">Specific Unit</SelectItem>
                      <SelectItem value="tenant_type">Tenant Type</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.audience === 'floor' && (
                  <div className="space-y-2">
                    <Label htmlFor="floor">Floor Number</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    />
                  </div>
                )}

                {formData.audience === 'unit' && (
                  <div className="space-y-2">
                    <Label htmlFor="unitId">Unit</Label>
                    <Select
                      value={formData.unitId}
                      onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                      disabled={!formData.buildingId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit._id} value={unit._id}>
                            {unit.unitNumber} (Floor {unit.floor})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.audience === 'tenant_type' && (
                  <div className="space-y-2">
                    <Label htmlFor="tenantType">Tenant Type</Label>
                    <Select
                      value={formData.tenantType || ''}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, tenantType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <textarea
                  id="content"
                  className="w-full min-h-[200px] px-3 py-2 border rounded-md"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter notice content (supports HTML)..."
                  required
                />
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/org/notices">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.title || !formData.content}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating...' : 'Create Notice'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}

