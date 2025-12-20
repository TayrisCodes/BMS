'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { apiGet, apiPatch, apiDelete } from '@/lib/utils/api-client';
import {
  ArrowLeft,
  Package,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Home,
  Bed,
  Bath,
  DollarSign,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  History,
} from 'lucide-react';

interface Unit {
  _id: string;
  buildingId: string;
  unitNumber: string;
  floor?: number | null;
  unitType: string;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: string;
  rentAmount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface Building {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
}

interface TenantHistoryEntry {
  lease: {
    _id: string;
    startDate: string;
    endDate?: string | null;
    terminationDate?: string | null;
    terminationReason?: string | null;
    rentAmount: number;
    depositAmount?: number | null;
    billingCycle: string;
    status: string;
  };
  tenant: {
    _id: string;
    firstName: string;
    lastName: string;
    primaryPhone: string;
    email?: string | null;
  } | null;
}

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;
  const [unit, setUnit] = useState<Unit | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [currentTenant, setCurrentTenant] = useState<TenantHistoryEntry | null>(null);
  const [previousTenants, setPreviousTenants] = useState<TenantHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    unitTypes: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
    buildings: Building[];
  } | null>(null);
  const [editUnitType, setEditUnitType] = useState<string>('apartment');

  // Check if bedrooms/bathrooms should be shown (only for apartments)
  const showBedroomsBathrooms = editUnitType === 'apartment';

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const unitData = await apiGet<{ unit: Unit }>(`/api/units/${unitId}`);
        setUnit(unitData.unit);

        // Fetch building
        const buildingData = await apiGet<{ building: Building }>(
          `/api/buildings/${unitData.unit.buildingId}`,
        );
        setBuilding(buildingData.building);

        // Fetch tenant history
        try {
          const historyData = await apiGet<{
            currentTenant: TenantHistoryEntry | null;
            previousTenants: TenantHistoryEntry[];
            allHistory: TenantHistoryEntry[];
          }>(`/api/units/${unitId}/tenants`);

          setCurrentTenant(historyData.currentTenant);
          setPreviousTenants(historyData.previousTenants);
        } catch {
          // No tenant history found
        }

        // Fetch metadata for edit form
        try {
          const metaData = await apiGet<{
            unitTypes: { value: string; label: string }[];
            statuses: { value: string; label: string }[];
            buildings: Building[];
          }>('/api/units/new');
          setMetadata(metaData);
        } catch {
          // Metadata fetch failed, but not critical
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load unit');
      } finally {
        setIsLoading(false);
      }
    }

    if (unitId) {
      fetchData();
    }
  }, [unitId]);

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const unitType = formData.get('unitType')?.toString() || unit?.unitType || 'apartment';
    const isApartment = unitType === 'apartment';

    const updates = {
      unitNumber: formData.get('unitNumber')?.toString() || unit?.unitNumber,
      floor: formData.get('floor') ? parseInt(formData.get('floor')!.toString()) : null,
      unitType,
      area: formData.get('area') ? parseFloat(formData.get('area')!.toString()) : null,
      bedrooms:
        isApartment && formData.get('bedrooms')
          ? parseInt(formData.get('bedrooms')!.toString())
          : null,
      bathrooms:
        isApartment && formData.get('bathrooms')
          ? parseFloat(formData.get('bathrooms')!.toString())
          : null,
      status: formData.get('status')?.toString() || unit?.status,
      rentAmount: formData.get('rentAmount')
        ? parseFloat(formData.get('rentAmount')!.toString())
        : null,
    };

    try {
      const result = await apiPatch<{ unit: Unit }>(`/api/units/${unitId}`, updates);
      setUnit(result.unit);
      setIsEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update unit');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        'Are you sure you want to delete this unit? This will set its status to maintenance.',
      )
    ) {
      return;
    }

    try {
      await apiDelete(`/api/units/${unitId}`);
      router.push(`/admin/buildings/${unit?.buildingId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  }

  function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'occupied':
        return 'default';
      case 'available':
        return 'secondary';
      case 'maintenance':
      case 'reserved':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading unit details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive mb-4">{error || 'Unit not found'}</p>
            <Link href="/org/units">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Units
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/admin/buildings/${unit.buildingId}`}>
            <Button variant="ghost" size="sm" className="mt-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-bold">{unit.unitNumber}</h1>
                <Badge variant={getStatusVariant(unit.status)} className="text-sm px-3 py-1">
                  {unit.status}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {building?.name || 'Unknown Building'}
                {building?.address?.city && ` • ${building.address.city}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsEditOpen(true)} variant="default">
            <Edit className="h-4 w-4 mr-2" />
            Edit Unit
          </Button>
          <Button onClick={handleDelete} variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unit Information Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Unit Information
            </CardTitle>
            <CardDescription>Detailed information about this unit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Unit Number
                </div>
                <p className="text-lg font-semibold">{unit.unitNumber}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Home className="h-4 w-4" />
                  Unit Type
                </div>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {unit.unitType}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Floor
                </div>
                <p className="text-lg font-semibold">{unit.floor ?? 'N/A'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Home className="h-4 w-4" />
                  Area
                </div>
                <p className="text-lg font-semibold">{unit.area ? `${unit.area} m²` : 'N/A'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bed className="h-4 w-4" />
                  Bedrooms
                </div>
                <p className="text-lg font-semibold">{unit.bedrooms ?? 'N/A'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bath className="h-4 w-4" />
                  Bathrooms
                </div>
                <p className="text-lg font-semibold">{unit.bathrooms ?? 'N/A'}</p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Base Rent
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(unit.rentAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Tenant Card */}
        {currentTenant && currentTenant.tenant ? (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Current Tenant
              </CardTitle>
              <CardDescription>Active lease information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Link href={`/admin/tenants/${currentTenant.tenant._id}`}>
                  <p className="text-xl font-semibold hover:text-primary cursor-pointer transition-colors">
                    {currentTenant.tenant.firstName} {currentTenant.tenant.lastName}
                  </p>
                </Link>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Phone className="h-3 w-3" />
                  {currentTenant.tenant.primaryPhone}
                </div>
                {currentTenant.tenant.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Mail className="h-3 w-3" />
                    {currentTenant.tenant.email}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" />
                    Lease Period
                  </div>
                  <p className="text-sm font-medium">
                    {new Date(currentTenant.lease.startDate).toLocaleDateString()} -{' '}
                    {currentTenant.lease.endDate
                      ? new Date(currentTenant.lease.endDate).toLocaleDateString()
                      : 'Ongoing'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    Rent Amount
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(currentTenant.lease.rentAmount)} /{' '}
                    {currentTenant.lease.billingCycle}
                  </p>
                </div>

                <div>
                  <Badge variant="outline" className="text-xs">
                    {currentTenant.lease.billingCycle}
                  </Badge>
                </div>

                <Link href={`/admin/leases/${currentTenant.lease._id}`}>
                  <Button variant="outline" className="w-full mt-4">
                    <FileText className="h-4 w-4 mr-2" />
                    View Lease Details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">No current tenant</p>
              <p className="text-sm text-muted-foreground text-center mt-1">
                This unit is available
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tenant History Section */}
      {previousTenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Tenant History
            </CardTitle>
            <CardDescription>
              Complete history of all tenants who have occupied this unit ({previousTenants.length}{' '}
              previous
              {previousTenants.length === 1 ? ' tenant' : ' tenants'})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {previousTenants.map((entry) => (
                <div
                  key={entry.lease._id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {entry.tenant ? (
                        <Link href={`/admin/tenants/${entry.tenant._id}`}>
                          <p className="font-semibold text-lg hover:text-primary cursor-pointer transition-colors">
                            {entry.tenant.firstName} {entry.tenant.lastName}
                          </p>
                        </Link>
                      ) : (
                        <p className="font-semibold text-lg text-muted-foreground">
                          Unknown Tenant
                        </p>
                      )}
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            <span className="font-medium">Period:</span>{' '}
                            {new Date(entry.lease.startDate).toLocaleDateString()} -{' '}
                            {entry.lease.endDate
                              ? new Date(entry.lease.endDate).toLocaleDateString()
                              : entry.lease.terminationDate
                                ? new Date(entry.lease.terminationDate).toLocaleDateString()
                                : 'Ongoing'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          <span>
                            <span className="font-medium">Rent:</span>{' '}
                            {formatCurrency(entry.lease.rentAmount)} / {entry.lease.billingCycle}
                          </span>
                        </div>
                        {entry.lease.terminationReason && (
                          <div className="text-muted-foreground">
                            <span className="font-medium">Termination Reason:</span>{' '}
                            {entry.lease.terminationReason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <Badge
                        variant={
                          entry.lease.status === 'terminated'
                            ? 'destructive'
                            : entry.lease.status === 'expired'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {entry.lease.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (open && unit) {
            setEditUnitType(unit.unitType);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Update the unit information below</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            {editError && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">
                {editError}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-unitNumber">Unit Number *</Label>
                  <Input
                    id="edit-unitNumber"
                    name="unitNumber"
                    defaultValue={unit.unitNumber}
                    required
                    placeholder="e.g., A-101"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-floor">Floor</Label>
                  <Input
                    id="edit-floor"
                    name="floor"
                    type="number"
                    defaultValue={unit.floor ?? ''}
                    placeholder="e.g., 1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-unitType">Unit Type *</Label>
                  {metadata ? (
                    <Select
                      name="unitType"
                      defaultValue={unit.unitType}
                      required
                      onValueChange={setEditUnitType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {metadata.unitTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="edit-unitType"
                      name="unitType"
                      defaultValue={unit.unitType}
                      required
                      onChange={(e) => setEditUnitType(e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-status">Status *</Label>
                  {metadata ? (
                    <Select name="status" defaultValue={unit.status} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {metadata.statuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input id="edit-status" name="status" defaultValue={unit.status} required />
                  )}
                </div>
              </div>

              <div className={showBedroomsBathrooms ? 'grid grid-cols-3 gap-4' : ''}>
                <div className={showBedroomsBathrooms ? '' : 'w-full'}>
                  <Label htmlFor="edit-area">Area (m²)</Label>
                  <Input
                    id="edit-area"
                    name="area"
                    type="number"
                    step="0.01"
                    defaultValue={unit.area ?? ''}
                    placeholder="e.g., 50.5"
                  />
                </div>
                {showBedroomsBathrooms && (
                  <>
                    <div>
                      <Label htmlFor="edit-bedrooms">Bedrooms</Label>
                      <Input
                        id="edit-bedrooms"
                        name="bedrooms"
                        type="number"
                        min="0"
                        defaultValue={unit.bedrooms ?? ''}
                        placeholder="e.g., 2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-bathrooms">Bathrooms</Label>
                      <Input
                        id="edit-bathrooms"
                        name="bathrooms"
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={unit.bathrooms ?? ''}
                        placeholder="e.g., 1.5"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label htmlFor="edit-rentAmount">Base Rent (ETB)</Label>
                <Input
                  id="edit-rentAmount"
                  name="rentAmount"
                  type="number"
                  step="0.01"
                  defaultValue={unit.rentAmount ?? ''}
                  placeholder="e.g., 5000"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
