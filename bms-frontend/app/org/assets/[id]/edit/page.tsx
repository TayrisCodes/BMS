'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
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
import { apiGet, apiPut } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { ArrowLeft, Package } from 'lucide-react';

interface Asset {
  _id: string;
  buildingId: string;
  unitId?: string | null;
  name: string;
  description?: string | null;
  assetType: string;
  status: string;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  location?: string | null;
  warranty?: {
    startDate?: string | null;
    endDate?: string | null;
    provider?: string | null;
    warrantyNumber?: string | null;
    terms?: string | null;
  } | null;
  depreciation?: {
    method?: string | null;
    usefulLifeYears?: number | null;
    depreciationStartDate?: string | null;
  } | null;
  installationDate?: string | null;
  supplier?: string | null;
  supplierContact?: string | null;
  maintenanceSchedule?: {
    frequency?: string | null;
    lastMaintenanceDate?: string | null;
    nextMaintenanceDate?: string | null;
  } | null;
  notes?: string | null;
}

interface Building {
  _id: string;
  name: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [hasWarranty, setHasWarranty] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [assetData, buildingsData] = await Promise.all([
          apiGet<{ asset: Asset }>(`/api/assets/${assetId}`),
          apiGet<{ buildings: Building[] }>('/api/buildings'),
        ]);

        const loadedAsset = assetData.asset;
        setAsset(loadedAsset);
        setSelectedBuildingId(loadedAsset.buildingId);
        setSelectedUnitId(loadedAsset.unitId || '');
        setHasWarranty(!!loadedAsset.warranty);
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load asset');
        console.error('Failed to fetch asset', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [assetId]);

  // Fetch units when building is selected
  useEffect(() => {
    async function fetchUnits() {
      if (!selectedBuildingId) {
        setUnits([]);
        return;
      }

      try {
        const unitsData = await apiGet<{ units: Unit[] }>(
          `/api/units?buildingId=${selectedBuildingId}`,
        );
        setUnits(unitsData.units || []);
      } catch (err) {
        console.error('Failed to fetch units', err);
        setUnits([]);
      }
    }

    fetchUnits();
  }, [selectedBuildingId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const assetData: Record<string, unknown> = {
      buildingId: selectedBuildingId,
      unitId: selectedUnitId || null,
      name: formData.get('name')?.toString() || '',
      description: formData.get('description')?.toString() || null,
      assetType: formData.get('assetType')?.toString() || 'other',
      status: formData.get('status')?.toString() || 'active',
      serialNumber: formData.get('serialNumber')?.toString() || null,
      model: formData.get('model')?.toString() || null,
      manufacturer: formData.get('manufacturer')?.toString() || null,
      purchaseDate: formData.get('purchaseDate')?.toString() || null,
      purchasePrice: formData.get('purchasePrice')
        ? parseFloat(formData.get('purchasePrice')!.toString())
        : null,
      currentValue: formData.get('currentValue')
        ? parseFloat(formData.get('currentValue')!.toString())
        : null,
      location: formData.get('location')?.toString() || null,
      installationDate: formData.get('installationDate')?.toString() || null,
      supplier: formData.get('supplier')?.toString() || null,
      supplierContact: formData.get('supplierContact')?.toString() || null,
      notes: formData.get('notes')?.toString() || null,
    };

    // Warranty information
    if (hasWarranty) {
      assetData.warranty = {
        startDate: formData.get('warrantyStartDate')?.toString() || null,
        endDate: formData.get('warrantyEndDate')?.toString() || null,
        provider: formData.get('warrantyProvider')?.toString() || null,
        warrantyNumber: formData.get('warrantyNumber')?.toString() || null,
        terms: formData.get('warrantyTerms')?.toString() || null,
      };
    } else {
      assetData.warranty = null;
    }

    // Depreciation information
    const depreciationMethod = formData.get('depreciationMethod')?.toString();
    if (depreciationMethod) {
      assetData.depreciation = {
        method: depreciationMethod,
        usefulLifeYears: formData.get('usefulLifeYears')
          ? parseFloat(formData.get('usefulLifeYears')!.toString())
          : null,
        depreciationStartDate: formData.get('depreciationStartDate')?.toString() || null,
      };
    } else {
      assetData.depreciation = null;
    }

    // Maintenance schedule
    const maintenanceFrequency = formData.get('maintenanceFrequency')?.toString();
    if (maintenanceFrequency) {
      assetData.maintenanceSchedule = {
        frequency: maintenanceFrequency,
        lastMaintenanceDate: formData.get('lastMaintenanceDate')?.toString() || null,
        nextMaintenanceDate: formData.get('nextMaintenanceDate')?.toString() || null,
      };
    } else {
      assetData.maintenanceSchedule = null;
    }

    try {
      await apiPut(`/api/assets/${assetId}`, assetData);
      router.push(`/org/assets/${assetId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update asset');
      setIsSubmitting(false);
    }
  }

  function formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Edit Asset"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Assets', href: '/org/assets' },
          { label: 'Edit', href: '#' },
        ]}
      >
        <div className="col-span-full text-center py-8">
          <p className="text-muted-foreground">Loading asset...</p>
        </div>
      </DashboardPage>
    );
  }

  if (error && !asset) {
    return (
      <DashboardPage
        title="Edit Asset"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Assets', href: '/org/assets' },
          { label: 'Edit', href: '#' },
        ]}
      >
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      </DashboardPage>
    );
  }

  if (!asset) {
    return null;
  }

  return (
    <DashboardPage
      title="Edit Asset"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Assets', href: '/org/assets' },
        { label: asset.name, href: `/org/assets/${assetId}` },
        { label: 'Edit', href: '#' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Edit Asset</h1>
        </div>
        <Link href={`/org/assets/${assetId}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="col-span-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">
                  Asset Name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" name="name" defaultValue={asset.name} required />
              </div>
              <div>
                <Label htmlFor="assetType">
                  Asset Type <span className="text-destructive">*</span>
                </Label>
                <Select name="assetType" defaultValue={asset.assetType} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="furniture">Furniture</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="appliance">Appliance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="buildingId">
                  Building <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                  <SelectTrigger>
                    <SelectValue />
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
              <div>
                <Label htmlFor="unitId">Unit (Optional)</Label>
                <Select
                  value={selectedUnitId}
                  onValueChange={setSelectedUnitId}
                  disabled={!selectedBuildingId}
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
              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={asset.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="disposed">Disposed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={asset.location || ''}
                  placeholder="e.g., Floor 3, Room 301"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={asset.description || ''}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identification Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  name="serialNumber"
                  defaultValue={asset.serialNumber || ''}
                />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" defaultValue={asset.model || ''} />
              </div>
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  name="manufacturer"
                  defaultValue={asset.manufacturer || ''}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  name="purchaseDate"
                  type="date"
                  defaultValue={formatDateForInput(asset.purchaseDate)}
                />
              </div>
              <div>
                <Label htmlFor="purchasePrice">Purchase Price (ETB)</Label>
                <Input
                  id="purchasePrice"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  defaultValue={asset.purchasePrice || ''}
                />
              </div>
              <div>
                <Label htmlFor="currentValue">Current Value (ETB)</Label>
                <Input
                  id="currentValue"
                  name="currentValue"
                  type="number"
                  step="0.01"
                  defaultValue={asset.currentValue || ''}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="depreciationMethod">Depreciation Method</Label>
                <Select name="depreciationMethod" defaultValue={asset.depreciation?.method || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="straight-line">Straight-Line</SelectItem>
                    <SelectItem value="declining-balance">Declining Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="usefulLifeYears">Useful Life (Years)</Label>
                <Input
                  id="usefulLifeYears"
                  name="usefulLifeYears"
                  type="number"
                  step="0.1"
                  defaultValue={asset.depreciation?.usefulLifeYears || ''}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="depreciationStartDate">Depreciation Start Date</Label>
              <Input
                id="depreciationStartDate"
                name="depreciationStartDate"
                type="date"
                defaultValue={formatDateForInput(asset.depreciation?.depreciationStartDate)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warranty Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasWarranty"
                checked={hasWarranty}
                onChange={(e) => setHasWarranty(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="hasWarranty">Asset has warranty</Label>
            </div>
            {hasWarranty && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warrantyStartDate">Warranty Start Date</Label>
                  <Input
                    id="warrantyStartDate"
                    name="warrantyStartDate"
                    type="date"
                    defaultValue={formatDateForInput(asset.warranty?.startDate)}
                  />
                </div>
                <div>
                  <Label htmlFor="warrantyEndDate">Warranty End Date</Label>
                  <Input
                    id="warrantyEndDate"
                    name="warrantyEndDate"
                    type="date"
                    defaultValue={formatDateForInput(asset.warranty?.endDate)}
                  />
                </div>
                <div>
                  <Label htmlFor="warrantyProvider">Warranty Provider</Label>
                  <Input
                    id="warrantyProvider"
                    name="warrantyProvider"
                    defaultValue={asset.warranty?.provider || ''}
                  />
                </div>
                <div>
                  <Label htmlFor="warrantyNumber">Warranty Number</Label>
                  <Input
                    id="warrantyNumber"
                    name="warrantyNumber"
                    defaultValue={asset.warranty?.warrantyNumber || ''}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="warrantyTerms">Warranty Terms</Label>
                  <Textarea
                    id="warrantyTerms"
                    name="warrantyTerms"
                    rows={3}
                    defaultValue={asset.warranty?.terms || ''}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier & Installation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input id="supplier" name="supplier" defaultValue={asset.supplier || ''} />
              </div>
              <div>
                <Label htmlFor="supplierContact">Supplier Contact</Label>
                <Input
                  id="supplierContact"
                  name="supplierContact"
                  defaultValue={asset.supplierContact || ''}
                />
              </div>
              <div>
                <Label htmlFor="installationDate">Installation Date</Label>
                <Input
                  id="installationDate"
                  name="installationDate"
                  type="date"
                  defaultValue={formatDateForInput(asset.installationDate)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="maintenanceFrequency">Frequency</Label>
                <Select
                  name="maintenanceFrequency"
                  defaultValue={asset.maintenanceSchedule?.frequency || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lastMaintenanceDate">Last Maintenance Date</Label>
                <Input
                  id="lastMaintenanceDate"
                  name="lastMaintenanceDate"
                  type="date"
                  defaultValue={formatDateForInput(asset.maintenanceSchedule?.lastMaintenanceDate)}
                />
              </div>
              <div>
                <Label htmlFor="nextMaintenanceDate">Next Maintenance Date</Label>
                <Input
                  id="nextMaintenanceDate"
                  name="nextMaintenanceDate"
                  type="date"
                  defaultValue={formatDateForInput(asset.maintenanceSchedule?.nextMaintenanceDate)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={asset.notes || ''}
              placeholder="Any additional notes..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href={`/org/assets/${assetId}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Asset'}
          </Button>
        </div>
      </form>
    </DashboardPage>
  );
}

