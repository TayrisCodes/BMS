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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { TrendingUp, ArrowLeft, Package, AlertTriangle, CheckCircle } from 'lucide-react';

interface AssetReliability {
  assetId: string;
  assetName: string;
  assetType: string;
  reliabilityScore: number;
  maintenanceFrequency: number;
  totalDowntimeHours: number;
  totalMaintenanceCost: number;
  averageCostPerMaintenance: number | null;
  daysSinceLastMaintenance: number | null;
  preventiveCount: number;
  correctiveCount: number;
  emergencyCount: number;
}

export default function AssetReliabilityPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetReliability[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<AssetReliability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'frequency' | 'cost' | 'downtime'>('score');

  useEffect(() => {
    async function fetchAssets() {
      try {
        setIsLoading(true);
        // Fetch all assets and their reliability metrics
        const assetsData = await apiGet<{
          assets: Array<{ _id: string; name: string; assetType: string }>;
        }>('/api/assets');

        // Fetch reliability metrics for each asset
        const reliabilityPromises = assetsData.assets.map(async (asset) => {
          try {
            const metricsData = await apiGet<{ metrics: any; reliabilityScore: number }>(
              `/api/assets/${asset._id}/reliability?periodMonths=12`,
            );
            return {
              assetId: asset._id,
              assetName: asset.name,
              assetType: asset.assetType,
              reliabilityScore: metricsData.reliabilityScore,
              ...metricsData.metrics,
            };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(reliabilityPromises);
        const validResults = results.filter((r) => r !== null) as AssetReliability[];
        setAssets(validResults);
        setFilteredAssets(validResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load asset reliability data');
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
      filtered = filtered.filter((a) =>
        a.assetName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((a) => a.assetType === typeFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.reliabilityScore - a.reliabilityScore;
        case 'frequency':
          return b.maintenanceFrequency - a.maintenanceFrequency;
        case 'cost':
          return b.totalMaintenanceCost - a.totalMaintenanceCost;
        case 'downtime':
          return b.totalDowntimeHours - a.totalDowntimeHours;
        default:
          return 0;
      }
    });

    setFilteredAssets(filtered);
  }, [searchTerm, typeFilter, sortBy, assets]);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getReliabilityBadge(score: number): {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    label: string;
    icon: any;
  } {
    if (score >= 80) {
      return { variant: 'default', label: 'Excellent', icon: CheckCircle };
    } else if (score >= 60) {
      return { variant: 'secondary', label: 'Good', icon: CheckCircle };
    } else if (score >= 40) {
      return { variant: 'outline', label: 'Fair', icon: AlertTriangle };
    } else {
      return { variant: 'destructive', label: 'Poor', icon: AlertTriangle };
    }
  }

  return (
    <DashboardPage
      title="Asset Reliability Dashboard"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Assets', href: '/org/assets' },
        { label: 'Reliability', href: '/org/assets/reliability' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Asset reliability metrics and trends</p>
        </div>
        <Link href="/org/assets">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assets
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <div className="relative flex-1">
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Reliability Score</SelectItem>
            <SelectItem value="frequency">Maintenance Frequency</SelectItem>
            <SelectItem value="cost">Total Cost</SelectItem>
            <SelectItem value="downtime">Downtime</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reliability Score</TableHead>
              <TableHead>Maintenance Frequency</TableHead>
              <TableHead>Total Downtime</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Maintenance Types</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">Loading reliability data...</p>
                </TableCell>
              </TableRow>
            ) : filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {assets.length === 0
                      ? 'No asset reliability data available.'
                      : 'No assets match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => {
                const reliability = getReliabilityBadge(asset.reliabilityScore);
                const ReliabilityIcon = reliability.icon;
                return (
                  <TableRow key={asset.assetId}>
                    <TableCell className="font-medium">{asset.assetName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.assetType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={reliability.variant}>
                          <ReliabilityIcon className="h-3 w-3 mr-1" />
                          {asset.reliabilityScore}/100
                        </Badge>
                        <span className="text-xs text-muted-foreground">({reliability.label})</span>
                      </div>
                    </TableCell>
                    <TableCell>{asset.maintenanceFrequency} events</TableCell>
                    <TableCell>{asset.totalDowntimeHours.toFixed(1)} hours</TableCell>
                    <TableCell>{formatCurrency(asset.totalMaintenanceCost)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant="default" className="text-xs">
                          P: {asset.preventiveCount}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          C: {asset.correctiveCount}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          E: {asset.emergencyCount}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/org/assets/${asset.assetId}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
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

