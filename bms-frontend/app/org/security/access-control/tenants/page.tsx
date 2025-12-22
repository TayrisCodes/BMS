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
import { Shield, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
}

interface Building {
  _id: string;
  name: string;
}

export default function TenantAccessPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    buildingId: '',
    tenantId: '',
    accessLevel: 'full' as 'full' | 'restricted' | 'denied',
    validFrom: '',
    validUntil: '',
    notes: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [tenantsData, buildingsData] = await Promise.all([
          apiGet<{ tenants: Tenant[] }>('/api/tenants'),
          apiGet<{ buildings: Building[] }>('/api/buildings'),
        ]);
        setTenants(tenantsData.tenants || []);
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    fetchData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        entityType: 'tenant',
        entityId: formData.tenantId,
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
    <DashboardPage title="Manage Tenant Access">
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
            <CardTitle>Create Tenant Access Permission</CardTitle>
            <CardDescription>Grant or restrict access for a tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant *</Label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant._id} value={tenant._id}>
                          {tenant.firstName} {tenant.lastName} ({tenant.primaryPhone})
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
                  disabled={isSubmitting || !formData.buildingId || !formData.tenantId}
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
