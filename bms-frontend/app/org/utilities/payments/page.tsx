'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/lib/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Eye,
  FileText,
  Zap,
  Droplet,
  Flame,
} from 'lucide-react';
import type { UtilityType } from '@/lib/utilities/utility-payments';

interface UtilityPayment {
  _id: string;
  meterId: string;
  utilityType: UtilityType;
  periodStart: string;
  periodEnd: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Meter {
  _id: string;
  meterNumber: string;
  meterType: string;
  buildingId: string;
  unitId?: string | null;
}

interface Building {
  _id: string;
  name: string;
}

const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
};

const UTILITY_TYPE_ICONS: Record<UtilityType, typeof Zap> = {
  electricity: Zap,
  water: Droplet,
  gas: Flame,
};

export default function UtilityPaymentsPage() {
  const [payments, setPayments] = useState<UtilityPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<UtilityPayment[]>([]);
  const [meters, setMeters] = useState<Record<string, Meter>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [utilityTypeFilter, setUtilityTypeFilter] = useState<string>('all');
  const [meterFilter, setMeterFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch utility payments
        const paymentsData = await apiGet<{ utilityPayments: UtilityPayment[] }>(
          '/api/utility-payments',
        );
        setPayments(paymentsData.utilityPayments || []);
        setFilteredPayments(paymentsData.utilityPayments || []);

        // Fetch meters and buildings
        const [metersData, buildingsData] = await Promise.all([
          apiGet<{ meters: Meter[] }>('/api/meters').catch(() => ({ meters: [] })),
          apiGet<{ buildings: Building[] }>('/api/buildings').catch(() => ({ buildings: [] })),
        ]);

        const metersMap: Record<string, Meter> = {};
        (metersData.meters || []).forEach((meter) => {
          metersMap[meter._id] = meter;
        });
        setMeters(metersMap);

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
    let filtered = payments;

    // Apply utility type filter
    if (utilityTypeFilter !== 'all') {
      filtered = filtered.filter((p) => p.utilityType === utilityTypeFilter);
    }

    // Apply meter filter
    if (meterFilter !== 'all') {
      filtered = filtered.filter((p) => p.meterId === meterFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        const meter = meters[p.meterId];
        const building = meter ? buildings[meter.buildingId] : null;
        return (
          meter?.meterNumber.toLowerCase().includes(searchLower) ||
          building?.name.toLowerCase().includes(searchLower) ||
          p.receiptFileName?.toLowerCase().includes(searchLower) ||
          p.notes?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by payment date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.paymentDate).getTime();
      const dateB = new Date(b.paymentDate).getTime();
      return dateB - dateA;
    });

    setFilteredPayments(filtered);
  }, [searchTerm, utilityTypeFilter, meterFilter, payments, meters, buildings]);

  function formatCurrency(amount: number): string {
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

  const availableMeters = Object.values(meters).filter((meter) => {
    if (utilityTypeFilter === 'all') return true;
    return meter.meterType === utilityTypeFilter;
  });

  return (
    <DashboardPage
      title="Utility Payments"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Utilities', href: '/org/meters' },
        { label: 'Payments', href: '/org/utilities/payments' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Utility Payments</h2>
              <p className="text-sm text-muted-foreground">
                Manage utility payment records with receipt attachments
              </p>
            </div>
          </div>
          <Link href="/org/utilities/payments/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by meter number, building, receipt file..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={utilityTypeFilter} onValueChange={setUtilityTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Utility Types</SelectItem>
              <SelectItem value="electricity">Electricity</SelectItem>
              <SelectItem value="water">Water</SelectItem>
              <SelectItem value="gas">Gas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={meterFilter} onValueChange={setMeterFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Meters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Meters</SelectItem>
              {availableMeters.map((meter) => (
                <SelectItem key={meter._id} value={meter._id}>
                  {meter.meterNumber} ({UTILITY_TYPE_LABELS[meter.meterType as UtilityType]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Records</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading payments...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {payments.length === 0
                    ? 'No utility payments found. Add your first payment record.'
                    : 'No payments match your filters.'}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utility Type</TableHead>
                      <TableHead>Meter</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => {
                      const meter = meters[payment.meterId];
                      const building = meter ? buildings[meter.buildingId] : null;
                      const IconComponent = UTILITY_TYPE_ICONS[payment.utilityType];

                      return (
                        <TableRow key={payment._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              <span className="font-medium">
                                {UTILITY_TYPE_LABELS[payment.utilityType]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{meter?.meterNumber || 'Unknown'}</p>
                              {building && (
                                <p className="text-xs text-muted-foreground">{building.name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{formatDate(payment.periodStart)}</p>
                              <p className="text-muted-foreground">
                                to {formatDate(payment.periodEnd)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {payment.paymentMethod
                                .split('_')
                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payment.receiptUrl ? (
                              <Badge variant="default" className="flex items-center gap-1 w-fit">
                                <FileText className="h-3 w-3" />
                                Receipt
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/org/utilities/payments/${payment._id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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
