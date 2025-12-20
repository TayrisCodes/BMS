'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  Package,
  ArrowLeft,
  Edit,
  Calendar,
  DollarSign,
  Wrench,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface Asset {
  _id: string;
  organizationId: string;
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
  maintenanceSchedule?: {
    frequency?: string | null;
    lastMaintenanceDate?: string | null;
    nextMaintenanceDate?: string | null;
  } | null;
  depreciation?: {
    method?: string | null;
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

interface MaintenanceHistory {
  _id: string;
  assetId: string;
  workOrderId?: string | null;
  maintenanceType: 'preventive' | 'corrective' | 'emergency';
  performedBy?: string | null;
  performedDate: string;
  description: string;
  cost?: number | null;
  partsUsed?: Array<{ name: string; quantity: number; cost: number }> | null;
  downtimeHours?: number | null;
  notes?: string | null;
  nextMaintenanceDue?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReliabilityMetrics {
  assetId: string;
  periodMonths: number;
  maintenanceFrequency: number;
  averageDaysBetweenMaintenance: number | null;
  totalDowntimeHours: number;
  averageDowntimeHours: number | null;
  totalMaintenanceCost: number;
  averageCostPerMaintenance: number | null;
  lastMaintenanceDate: string | null;
  daysSinceLastMaintenance: number | null;
  nextMaintenanceDue: string | null;
  daysUntilNextMaintenance: number | null;
  totalPartsCost: number;
  preventiveCount: number;
  correctiveCount: number;
  emergencyCount: number;
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [reliabilityMetrics, setReliabilityMetrics] = useState<ReliabilityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [assetData, historyData, metricsData] = await Promise.all([
          apiGet<Asset>(`/api/assets/${assetId}`),
          apiGet<{ history: MaintenanceHistory[] }>(`/api/assets/${assetId}/maintenance-history`),
          apiGet<{ metrics: ReliabilityMetrics; reliabilityScore: number }>(
            `/api/assets/${assetId}/reliability?periodMonths=12`,
          ),
        ]);

        setAsset(assetData);
        setMaintenanceHistory(historyData.history || []);
        setReliabilityMetrics(metricsData.metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load asset details');
      } finally {
        setIsLoading(false);
      }
    }

    if (assetId) {
      fetchData();
    }
  }, [assetId]);

  function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getWarrantyStatus(asset: Asset): {
    status: 'active' | 'expired' | 'none';
    label: string;
    icon: any;
  } {
    if (!asset.warranty || !asset.warranty.endDate) {
      return { status: 'none', label: 'No Warranty', icon: XCircle };
    }

    const endDate = new Date(asset.warranty.endDate);
    const now = new Date();

    if (endDate < now) {
      return { status: 'expired', label: 'Expired', icon: AlertTriangle };
    }

    return { status: 'active', label: 'Active', icon: CheckCircle };
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Asset Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Assets', href: '/org/assets' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full text-center py-8">
          <p className="text-muted-foreground">Loading asset details...</p>
        </div>
      </DashboardPage>
    );
  }

  if (error || !asset) {
    return (
      <DashboardPage
        title="Asset Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Assets', href: '/org/assets' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'Asset not found'}
        </div>
      </DashboardPage>
    );
  }

  const warrantyStatus = getWarrantyStatus(asset);
  const WarrantyIcon = warrantyStatus.icon;

  return (
    <DashboardPage
      title="Asset Details"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Assets', href: '/org/assets' },
        { label: asset.name, href: '#' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <Badge variant="outline">{asset.assetType}</Badge>
          <Badge
            variant={
              warrantyStatus.status === 'active'
                ? 'default'
                : warrantyStatus.status === 'expired'
                  ? 'destructive'
                  : 'outline'
            }
          >
            <WarrantyIcon className="h-3 w-3 mr-1" />
            {warrantyStatus.label}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Link href={`/org/assets/${assetId}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Link href="/org/assets">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="col-span-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="warranty">Warranty</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
          <TabsTrigger value="reliability">Reliability</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className="ml-2">{asset.status}</Badge>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Serial Number:</span>
                  <span className="ml-2">{asset.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Model:</span>
                  <span className="ml-2">{asset.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Manufacturer:</span>
                  <span className="ml-2">{asset.manufacturer || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Location:</span>
                  <span className="ml-2">{asset.location || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Installation Date:</span>
                  <span className="ml-2">{formatDate(asset.installationDate)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Purchase Price:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(asset.purchasePrice)}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Current Value:</span>
                  <span className="ml-2 font-semibold">{formatCurrency(asset.currentValue)}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Purchase Date:</span>
                  <span className="ml-2">{formatDate(asset.purchaseDate)}</span>
                </div>
                {asset.depreciation && (
                  <>
                    <div>
                      <span className="text-sm text-muted-foreground">Depreciation Method:</span>
                      <span className="ml-2">{asset.depreciation.method || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Accumulated Depreciation:
                      </span>
                      <span className="ml-2">
                        {formatCurrency(asset.depreciation.accumulatedDepreciation)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maintenance Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Frequency:</span>
                  <span className="ml-2">{asset.maintenanceSchedule?.frequency || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Last Maintenance:</span>
                  <span className="ml-2">
                    {formatDate(asset.maintenanceSchedule?.lastMaintenanceDate)}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Next Maintenance:</span>
                  <span className="ml-2">
                    {formatDate(asset.maintenanceSchedule?.nextMaintenanceDate)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supplier Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Supplier:</span>
                  <span className="ml-2">{asset.supplier || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Contact:</span>
                  <span className="ml-2">{asset.supplierContact || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {asset.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{asset.description}</p>
              </CardContent>
            </Card>
          )}

          {asset.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{asset.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="warranty" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warranty Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {asset.warranty ? (
                <>
                  <div className="flex items-center gap-2">
                    <WarrantyIcon
                      className={`h-5 w-5 ${
                        warrantyStatus.status === 'active'
                          ? 'text-green-500'
                          : warrantyStatus.status === 'expired'
                            ? 'text-red-500'
                            : 'text-gray-500'
                      }`}
                    />
                    <span className="font-semibold">Status: {warrantyStatus.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Start Date:</span>
                      <p className="font-medium">{formatDate(asset.warranty.startDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">End Date:</span>
                      <p className="font-medium">{formatDate(asset.warranty.endDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Provider:</span>
                      <p className="font-medium">{asset.warranty.provider || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Warranty Number:</span>
                      <p className="font-medium">{asset.warranty.warrantyNumber || 'N/A'}</p>
                    </div>
                  </div>
                  {asset.warranty.terms && (
                    <div>
                      <span className="text-sm text-muted-foreground">Terms:</span>
                      <p className="text-sm mt-1">{asset.warranty.terms}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No warranty information available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>Past maintenance activities for this asset</CardDescription>
            </CardHeader>
            <CardContent>
              {maintenanceHistory.length === 0 ? (
                <p className="text-muted-foreground">No maintenance history available.</p>
              ) : (
                <div className="space-y-4">
                  {maintenanceHistory.map((history) => (
                    <div key={history._id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                history.maintenanceType === 'preventive'
                                  ? 'default'
                                  : history.maintenanceType === 'emergency'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {history.maintenanceType}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(history.performedDate)}
                            </span>
                          </div>
                          <p className="mt-1 font-medium">{history.description}</p>
                        </div>
                        {history.cost && (
                          <span className="font-semibold">{formatCurrency(history.cost)}</span>
                        )}
                      </div>
                      {history.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{history.notes}</p>
                      )}
                      {history.partsUsed && history.partsUsed.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Parts Used:</p>
                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                            {history.partsUsed.map((part, idx) => (
                              <li key={idx}>
                                {part.name} (Qty: {part.quantity}) -{' '}
                                {formatCurrency(part.cost * part.quantity)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {history.downtimeHours && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Downtime: {history.downtimeHours.toFixed(2)} hours
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reliability" className="space-y-4">
          {reliabilityMetrics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Maintenance Frequency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {reliabilityMetrics.maintenanceFrequency}
                    </div>
                    <p className="text-sm text-muted-foreground">events in last 12 months</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Downtime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {reliabilityMetrics.totalDowntimeHours.toFixed(1)}
                    </div>
                    <p className="text-sm text-muted-foreground">hours in last 12 months</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(reliabilityMetrics.totalMaintenanceCost)}
                    </div>
                    <p className="text-sm text-muted-foreground">in last 12 months</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Reliability Metrics</CardTitle>
                  <CardDescription>Performance indicators for the last 12 months</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Average Days Between Maintenance:
                      </span>
                      <p className="font-medium">
                        {reliabilityMetrics.averageDaysBetweenMaintenance
                          ? reliabilityMetrics.averageDaysBetweenMaintenance.toFixed(1)
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Average Downtime:</span>
                      <p className="font-medium">
                        {reliabilityMetrics.averageDowntimeHours
                          ? `${reliabilityMetrics.averageDowntimeHours.toFixed(2)} hours`
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Average Cost per Maintenance:
                      </span>
                      <p className="font-medium">
                        {formatCurrency(reliabilityMetrics.averageCostPerMaintenance)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Days Since Last Maintenance:
                      </span>
                      <p className="font-medium">
                        {reliabilityMetrics.daysSinceLastMaintenance !== null
                          ? `${reliabilityMetrics.daysSinceLastMaintenance} days`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Maintenance Type Breakdown:</p>
                    <div className="flex gap-4">
                      <Badge variant="default">
                        Preventive: {reliabilityMetrics.preventiveCount}
                      </Badge>
                      <Badge variant="secondary">
                        Corrective: {reliabilityMetrics.correctiveCount}
                      </Badge>
                      <Badge variant="destructive">
                        Emergency: {reliabilityMetrics.emergencyCount}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No reliability metrics available.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardPage>
  );
}

