'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Separator } from '@/lib/components/ui/separator';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { Loader2, Building2, Filter, CheckCircle2, AlertCircle } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
  totalFloors?: number | null;
  rentPolicy?: {
    baseRatePerSqm: number;
    decrementPerFloor?: number | null;
    groundFloorMultiplier?: number | null;
    minRatePerSqm?: number | null;
    effectiveDate?: string | null;
    floorOverrides?: { floor: number; ratePerSqm: number }[] | null;
  } | null;
}

interface PreviewResult {
  leaseId: string;
  unitId: string;
  oldRent?: number | null;
  newRent?: number | null;
  rateSource?: string;
}

export default function RentManagementPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<Building['rentPolicy']>({
    baseRatePerSqm: 0,
    decrementPerFloor: 0,
    groundFloorMultiplier: 1,
    minRatePerSqm: 0,
    effectiveDate: null,
    floorOverrides: [],
  });
  const [floorFrom, setFloorFrom] = useState<number>(0);
  const [floorTo, setFloorTo] = useState<number>(0);
  const [preview, setPreview] = useState<PreviewResult[]>([]);
  const [applyNotifications, setApplyNotifications] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ buildings: Building[] }>('/api/buildings')
      .then((res) => {
        setBuildings(res.buildings || []);
        if (res.buildings?.length) {
          const firstBuilding = res.buildings[0];
          if (firstBuilding) {
            setSelectedBuildingId(firstBuilding._id);
            setPolicy((prevPolicy) => firstBuilding.rentPolicy || prevPolicy);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load buildings'));
  }, []);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b._id === selectedBuildingId),
    [buildings, selectedBuildingId],
  );

  async function handlePreview(apply = false) {
    if (!selectedBuildingId) return;
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        buildingId: selectedBuildingId,
        policy,
        floorFilter: { from: floorFrom, to: floorTo || floorFrom },
        apply,
      };
      const res = await apiPost<{ results: PreviewResult[] }>('/api/rent/bulk-update', body);
      setPreview(res.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview/apply');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setIsApplying(true);
    await handlePreview(true);
    setIsApplying(false);
  }

  return (
    <DashboardPage
      title="Rent Management"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Rent Management', href: '/org/rent' },
      ]}
    >
      <div className="col-span-full space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Building Rent Policy</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Define floor-based rent formulas and apply updates in bulk across units and leases.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Building</Label>
                <Select
                  value={selectedBuildingId}
                  onValueChange={(val) => setSelectedBuildingId(val)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBuilding && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Floors: {selectedBuilding.totalFloors ?? 'N/A'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Floor From</Label>
                  <Input
                    type="number"
                    value={floorFrom}
                    onChange={(e) => setFloorFrom(parseInt(e.target.value || '0', 10))}
                  />
                </div>
                <div>
                  <Label>Floor To</Label>
                  <Input
                    type="number"
                    value={floorTo}
                    onChange={(e) => setFloorTo(parseInt(e.target.value || '0', 10))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Base Rate per sqm</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={policy?.baseRatePerSqm ?? 0}
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      baseRatePerSqm: parseFloat(e.target.value || '0'),
                      ...prev,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Decrement per floor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={policy?.decrementPerFloor ?? 0}
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      baseRatePerSqm: prev?.baseRatePerSqm ?? 0,
                      ...prev,
                      decrementPerFloor: parseFloat(e.target.value || '0'),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Ground floor multiplier</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={policy?.groundFloorMultiplier ?? 1}
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      baseRatePerSqm: prev?.baseRatePerSqm ?? 0,
                      ...prev,
                      groundFloorMultiplier: parseFloat(e.target.value || '1'),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Minimum rate per sqm</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={policy?.minRatePerSqm ?? 0}
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      baseRatePerSqm: prev?.baseRatePerSqm ?? 0,
                      ...prev,
                      minRatePerSqm: parseFloat(e.target.value || '0'),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={
                    policy?.effectiveDate
                      ? new Date(policy.effectiveDate).toISOString().split('T')[0]!
                      : ''
                  }
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      baseRatePerSqm: prev?.baseRatePerSqm ?? 0,
                      ...prev,
                      effectiveDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="notifications"
                checked={applyNotifications}
                onCheckedChange={(v) => setApplyNotifications(Boolean(v))}
              />
              <Label htmlFor="notifications">Notify tenants on apply (in-app, email, notice)</Label>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => handlePreview(false)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview'}
              </Button>
              <Button variant="default" onClick={handleApply} disabled={loading || isApplying}>
                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply Updates'}
              </Button>
            </div>

            {preview.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">
                    {preview.length} leases impacted. Showing first 10.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {preview.slice(0, 10).map((p) => (
                    <div key={p.leaseId} className="border rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lease</span>
                        <Badge variant="outline" className="text-xs">
                          {p.rateSource || 'policy'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Old</span>
                        <span>ETB {(p.oldRent ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>New</span>
                        <span className="font-semibold">
                          ETB {(p.newRent ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
