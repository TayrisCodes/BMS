'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Package, Plus, Search, Edit, Trash2, Eye, TrendingUp } from 'lucide-react';

interface Asset {
  _id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  name: string;
  description?: string | null;
  assetType: 'equipment' | 'furniture' | 'infrastructure' | 'vehicle' | 'appliance' | 'other';
  status: 'active' | 'maintenance' | 'retired' | 'disposed';
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
  maintenanceSchedule?: {
    frequency?: string | null;
    lastMaintenanceDate?: string | null;
    nextMaintenanceDate?: string | null;
  } | null;
  depreciation?: {
    method?: 'straight-line' | 'declining-balance' | null;
    usefulLifeYears?: number | null;
    annualDepreciation?: number | null;
    depreciationStartDate?: string | null;
    accumulatedDepreciation?: number | null;
  } | null;
  installationDate?: string | null;
  supplier?: string | null;
  supplierContact?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function OrgAssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchAssets() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ assets: Asset[] }>('/api/assets')) as {
          assets: Asset[];
        };
        setAssets(data.assets || []);
        setFilteredAssets(data.assets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assets');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAssets();
  }, []);

  useEffect(() => {
    let filtered = assets;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.location?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((a) => a.assetType === typeFilter);
    }

    setFilteredAssets(filtered);
  }, [searchTerm, statusFilter, typeFilter, assets]);

  async function handleDelete(assetId: string) {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      await apiDelete(`/api/assets/${assetId}`);
      setAssets(assets.filter((a) => a._id !== assetId));
      setFilteredAssets(filteredAssets.filter((a) => a._id !== assetId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  }

  function getStatusBadgeVariant(
    status: Asset['status'],
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'active':
        return 'default';
      case 'maintenance':
        return 'secondary';
      case 'retired':
        return 'outline';
      case 'disposed':
        return 'destructive';
      default:
        return 'default';
    }
  }

  function getTypeLabel(type: Asset['assetType']): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getWarrantyStatus(asset: Asset): {
    status: 'active' | 'expired' | 'none';
    label: string;
  } {
    if (!asset.warranty || !asset.warranty.endDate) {
      return { status: 'none', label: 'No Warranty' };
    }

    const endDate = new Date(asset.warranty.endDate);
    const now = new Date();

    if (endDate < now) {
      return { status: 'expired', label: 'Expired' };
    }

    return { status: 'active', label: 'Active' };
  }

  return (
    <DashboardPage
      title="Assets"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Assets', href: '/org/assets' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Manage your building assets</p>
        </div>
        <div className="flex gap-2">
          <Link href="/org/assets/reliability">
            <Button variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              Reliability Dashboard
            </Button>
          </Link>
          <Link href="/org/assets/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Asset
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, serial number, model, manufacturer, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="furniture">Furniture</SelectItem>
            <SelectItem value="infrastructure">Infrastructure</SelectItem>
            <SelectItem value="vehicle">Vehicle</SelectItem>
            <SelectItem value="appliance">Appliance</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Warranty</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Current Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">Loading assets...</p>
                </TableCell>
              </TableRow>
            ) : filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {assets.length === 0
                      ? 'No assets found. Create your first asset.'
                      : 'No assets match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => {
                const warrantyStatus = getWarrantyStatus(asset);
                return (
                  <TableRow key={asset._id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(asset.assetType)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(asset.status)}>{asset.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          warrantyStatus.status === 'active'
                            ? 'default'
                            : warrantyStatus.status === 'expired'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {warrantyStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{asset.serialNumber ?? 'N/A'}</TableCell>
                    <TableCell>{asset.location ?? 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(asset.currentValue)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/org/assets/${asset._id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/org/assets/${asset._id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(asset._id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}
