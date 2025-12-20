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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { DollarSign, Plus, Calendar, Building2, CheckCircle, XCircle } from 'lucide-react';

interface ParkingPricing {
  _id: string;
  buildingId: string;
  spaceType: 'tenant' | 'visitor';
  pricingModel: 'monthly' | 'daily' | 'hourly';
  monthlyRate: number | null;
  dailyRate: number | null;
  hourlyRate: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Building {
  _id: string;
  name: string;
}

export default function ParkingPricingPage() {
  const router = useRouter();
  const [pricing, setPricing] = useState<ParkingPricing[]>([]);
  const [filteredPricing, setFilteredPricing] = useState<ParkingPricing[]>([]);
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [spaceTypeFilter, setSpaceTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch parking pricing
        const pricingData = await apiGet<{ parkingPricing: ParkingPricing[] }>(
          '/api/parking/pricing',
        );
        setPricing(pricingData.parkingPricing || []);
        setFilteredPricing(pricingData.pricingPricing || []);

        // Fetch buildings
        const buildingsData = await apiGet<{ buildings: Building[] }>('/api/buildings').catch(
          () => ({ buildings: [] }),
        );

        const buildingsMap: Record<string, Building> = {};
        (buildingsData.buildings || []).forEach((building) => {
          buildingsMap[building._id] = building;
        });
        setBuildings(buildingsMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = pricing;

    // Apply building filter
    if (buildingFilter !== 'all') {
      filtered = filtered.filter((p) => p.buildingId === buildingFilter);
    }

    // Apply space type filter
    if (spaceTypeFilter !== 'all') {
      filtered = filtered.filter((p) => p.spaceType === spaceTypeFilter);
    }

    // Apply active filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter((p) => p.isActive === (activeFilter === 'true'));
    }

    // Sort by effective date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.effectiveFrom).getTime();
      const dateB = new Date(b.effectiveFrom).getTime();
      return dateB - dateA;
    });

    setFilteredPricing(filtered);
  }, [buildingFilter, spaceTypeFilter, activeFilter, pricing]);

  function formatCurrency(amount: number | null): string {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const availableBuildings = Object.values(buildings);

  return (
    <DashboardPage
      title="Parking Pricing"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        { label: 'Pricing', href: '/org/parking/pricing' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Parking Pricing</h2>
              <p className="text-sm text-muted-foreground">
                Configure parking rates for tenants and visitors
              </p>
            </div>
          </div>
          <Link href="/org/parking/pricing/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Pricing
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <Select value={buildingFilter} onValueChange={setBuildingFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Buildings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buildings</SelectItem>
              {availableBuildings.map((building) => (
                <SelectItem key={building._id} value={building._id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={spaceTypeFilter} onValueChange={setSpaceTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Space Types</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
              <SelectItem value="visitor">Visitor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Pricing Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Configurations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading pricing...</p>
              </div>
            ) : filteredPricing.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {pricing.length === 0
                    ? 'No pricing configurations found. Add pricing to get started.'
                    : 'No pricing matches your filters.'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Building</TableHead>
                      <TableHead>Space Type</TableHead>
                      <TableHead>Pricing Model</TableHead>
                      <TableHead>Monthly Rate</TableHead>
                      <TableHead>Daily Rate</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Effective To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPricing.map((p) => {
                      const building = buildings[p.buildingId];

                      return (
                        <TableRow key={p._id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {building?.name || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {p.spaceType === 'tenant' ? 'Tenant' : 'Visitor'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {p.pricingModel === 'monthly'
                                ? 'Monthly'
                                : p.pricingModel === 'daily'
                                  ? 'Daily'
                                  : 'Hourly'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(p.monthlyRate)}</TableCell>
                          <TableCell>{formatCurrency(p.dailyRate)}</TableCell>
                          <TableCell>{formatCurrency(p.hourlyRate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(p.effectiveFrom)}
                            </div>
                          </TableCell>
                          <TableCell>{p.effectiveTo ? formatDate(p.effectiveTo) : '—'}</TableCell>
                          <TableCell>
                            {p.isActive ? (
                              <Badge variant="default" className="flex items-center gap-1 w-fit">
                                <CheckCircle className="h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                <XCircle className="h-3 w-3" />
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}

