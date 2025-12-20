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
import { Label } from '@/lib/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  FileText,
  Eye,
  Search,
  Calendar,
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  Filter,
  X,
  AlertCircle,
  Plus,
  Sparkles,
} from 'lucide-react';

interface Invoice {
  _id: string;
  leaseId: string;
  tenantId: string;
  unitId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  tax?: number | null;
  vatRate?: number | null;
  total: number;
  netIncomeBeforeVat?: number | null;
  netIncomeAfterVat?: number | null;
  status: string;
  paidAt?: string | null;
  notes?: string | null;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

interface Building {
  _id: string;
  name: string;
}

interface Lease {
  _id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate?: string | null;
  rentAmount: number;
  billingCycle: string;
  status: string;
}

export default function OrgInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Record<string, Tenant>>({});
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateMode, setGenerateMode] = useState<'single' | 'batch'>('single');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('');
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [tenantPaymentStatus, setTenantPaymentStatus] = useState<any>(null);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [monthlyGenerateResult, setMonthlyGenerateResult] = useState<any>(null);
  const [tenantLeases, setTenantLeases] = useState<Lease[]>([]);
  const [isLoadingTenantData, setIsLoadingTenantData] = useState(false);
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  // Helper function to fetch related data (tenants, units, buildings)
  async function fetchRelatedData(invoicesList: Invoice[]) {
    const tenantIds = [...new Set(invoicesList.map((inv) => inv.tenantId).filter(Boolean))];
    const unitIds = [...new Set(invoicesList.map((inv) => inv.unitId).filter(Boolean))];

    const tenantMap: Record<string, Tenant> = {};
    const unitMap: Record<string, Unit> = {};
    const buildingMap: Record<string, Building> = {};

    // Fetch all tenants in parallel
    if (tenantIds.length > 0) {
      const tenantPromises = tenantIds.map(async (tenantId) => {
        try {
          const tenantData = await apiGet<{ tenant: Tenant }>(`/api/tenants/${tenantId}`);
          return { tenantId, tenant: tenantData.tenant };
        } catch (err) {
          console.warn(`Failed to fetch tenant ${tenantId}:`, err);
          return null;
        }
      });

      const tenantResults = await Promise.all(tenantPromises);
      tenantResults.forEach((result) => {
        if (result) {
          tenantMap[result.tenantId] = result.tenant;
        }
      });
    }

    // Fetch all units in parallel
    if (unitIds.length > 0) {
      const unitPromises = unitIds.map(async (unitId) => {
        try {
          const unitData = await apiGet<{ unit: Unit }>(`/api/units/${unitId}`);
          return { unitId, unit: unitData.unit };
        } catch (err) {
          console.warn(`Failed to fetch unit ${unitId}:`, err);
          return null;
        }
      });

      const unitResults = await Promise.all(unitPromises);
      const buildingIdsToFetch = new Set<string>();

      unitResults.forEach((result) => {
        if (result) {
          unitMap[result.unitId] = result.unit;
          if (result.unit.buildingId) {
            buildingIdsToFetch.add(result.unit.buildingId);
          }
        }
      });

      // Fetch all buildings in parallel
      if (buildingIdsToFetch.size > 0) {
        const buildingPromises = Array.from(buildingIdsToFetch).map(async (buildingId) => {
          try {
            const buildingData = await apiGet<{ building: Building }>(
              `/api/buildings/${buildingId}`,
            );
            return { buildingId, building: buildingData.building };
          } catch (err) {
            console.warn(`Failed to fetch building ${buildingId}:`, err);
            return null;
          }
        });

        const buildingResults = await Promise.all(buildingPromises);
        buildingResults.forEach((result) => {
          if (result) {
            buildingMap[result.buildingId] = result.building;
          }
        });
      }
    }

    setTenants(tenantMap);
    setUnits(unitMap);
    setBuildings(buildingMap);
  }

  // Set default period to current month
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
  }, []);

  // Fetch tenants when dialog opens
  useEffect(() => {
    if (isGenerateOpen) {
      async function fetchTenants() {
        try {
          const tenantsData = await apiGet<{ tenants: Tenant[] }>('/api/tenants?status=active');
          setAllTenants(tenantsData.tenants || []);
        } catch (err) {
          console.error('Failed to fetch tenants', err);
        }
      }
      fetchTenants();
    } else {
      // Reset state when dialog closes
      setSelectedTenantId('');
      setSelectedLeaseId('');
      setTenantPaymentStatus(null);
      setTenantLeases([]);
    }
  }, [isGenerateOpen]);

  // Fetch tenant payment status and leases when tenant is selected
  useEffect(() => {
    if (selectedTenantId && isGenerateOpen) {
      async function fetchTenantData() {
        setIsLoadingTenantData(true);
        try {
          const paymentStatusData = await apiGet<{
            tenant: Tenant;
            paymentStatus: any;
            activeLeases: Lease[];
          }>(`/api/tenants/${selectedTenantId}/payment-status`);
          setTenantPaymentStatus(paymentStatusData.paymentStatus);
          setTenantLeases(paymentStatusData.activeLeases || []);
        } catch (err) {
          console.error('Failed to fetch tenant payment status', err);
          setGenerateError('Failed to load tenant payment information');
        } finally {
          setIsLoadingTenantData(false);
        }
      }
      fetchTenantData();
    }
  }, [selectedTenantId, isGenerateOpen]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const invoicesData = await apiGet<{ invoices: Invoice[] }>('/api/invoices');
        const invoicesList = invoicesData.invoices || [];
        setInvoices(invoicesList);
        setFilteredInvoices(invoicesList);

        // Fetch related data using helper function
        await fetchRelatedData(invoicesList);
      } catch (err) {
        console.error('Failed to load invoices:', err);
        setError(err instanceof Error ? err.message : 'Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = invoices;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter((inv) => {
        const tenant = tenants[inv.tenantId];
        const unit = units[inv.unitId];
        const building = unit ? buildings[unit.buildingId] : null;

        return (
          inv.invoiceNumber.toLowerCase().includes(query) ||
          (tenant && `${tenant.firstName} ${tenant.lastName}`.toLowerCase().includes(query)) ||
          (unit && unit.unitNumber.toLowerCase().includes(query)) ||
          (building && building.name.toLowerCase().includes(query))
        );
      });
    }

    setFilteredInvoices(filtered);
  }, [statusFilter, searchTerm, invoices, tenants, units, buildings]);

  const paidInvoices = filteredInvoices.filter((inv) => inv.status === 'paid');
  const overdueInvoices = filteredInvoices.filter((inv) => {
    if (inv.status === 'paid') return false;
    const dueDate = new Date(inv.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  });
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const hasActiveFilters = statusFilter !== 'all' || searchTerm !== '';

  function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function isOverdue(invoice: Invoice): boolean {
    if (invoice.status === 'paid') return false;
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  async function handleGenerateMonthly() {
    setIsGeneratingMonthly(true);
    setMonthlyGenerateResult(null);
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const result = await apiPost<{
        message: string;
        result: {
          organizationId: string;
          periodStart: string;
          periodEnd: string;
          summary: {
            total: number;
            successful: number;
            failed: number;
          };
          sentCount: number;
          sentErrors: number;
        };
      }>('/api/admin/billing/generate-monthly', {
        autoSend: true,
        forceRegenerate: false,
      });

      setMonthlyGenerateResult(result.result);
      setGenerateSuccess(
        `Generated ${result.result.summary.successful} invoices. ${result.result.sentCount} sent to tenants.`,
      );

      // Refresh invoices list and related data
      setTimeout(async () => {
        try {
          const invoicesData = await apiGet<{ invoices: Invoice[] }>('/api/invoices');
          const invoicesList = invoicesData.invoices || [];
          setInvoices(invoicesList);
          setFilteredInvoices(invoicesList);
          await fetchRelatedData(invoicesList);
        } catch (err) {
          console.error('Failed to refresh invoices', err);
        }
      }, 1000);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate monthly invoices');
    } finally {
      setIsGeneratingMonthly(false);
    }
  }

  async function handleGenerateInvoice() {
    setGenerateError(null);
    setGenerateSuccess(null);
    setIsGenerating(true);

    try {
      if (generateMode === 'single') {
        if (!selectedTenantId) {
          setGenerateError('Please select a tenant');
          setIsGenerating(false);
          return;
        }
        if (!selectedLeaseId) {
          setGenerateError('Please select a lease');
          setIsGenerating(false);
          return;
        }

        const payload: {
          leaseId: string;
          periodStart?: string;
          periodEnd?: string;
        } = {
          leaseId: selectedLeaseId,
        };

        if (periodStart && periodEnd) {
          payload.periodStart = new Date(periodStart).toISOString();
          payload.periodEnd = new Date(periodEnd + 'T23:59:59.999Z').toISOString();
        }

        const result = await apiPost<{
          invoice: { _id: string; invoiceNumber: string };
          paymentVerification?: {
            warnings: string[];
            hasUnpaidInvoices: boolean;
            hasOverdueInvoices: boolean;
            previousMonthPaid: boolean;
          };
          sent?: {
            success: boolean;
            channels: {
              in_app?: { sent: boolean };
              sms?: { sent: boolean; delivered: boolean };
            };
            errors?: string[];
          };
        }>('/api/invoices', payload);

        let successMessage = `Invoice generated successfully: ${result.invoice.invoiceNumber}`;

        // Add payment warnings if any
        if (result.paymentVerification && result.paymentVerification.warnings.length > 0) {
          successMessage += `\n\n⚠️ Payment Warnings:\n${result.paymentVerification.warnings.join('\n')}`;
        }

        // Add send status
        if (result.sent) {
          if (result.sent.success) {
            const channels: string[] = [];
            if (result.sent.channels.in_app?.sent) channels.push('In-app notification');
            if (result.sent.channels.sms?.delivered) channels.push('SMS');
            if (channels.length > 0) {
              successMessage += `\n\n✅ Invoice sent to tenant via: ${channels.join(', ')}`;
            }
          } else if (result.sent.errors && result.sent.errors.length > 0) {
            successMessage += `\n\n⚠️ Invoice sent but some channels failed:\n${result.sent.errors.join('\n')}`;
          }
        }

        setGenerateSuccess(successMessage);
      } else {
        // Batch generation
        if (!periodStart || !periodEnd) {
          setGenerateError('Please select a period');
          setIsGenerating(false);
          return;
        }

        const payload = {
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd + 'T23:59:59.999Z').toISOString(),
          forceRegenerate: false,
        };

        const result = await apiPost<{
          message: string;
          summary: { total: number; successful: number; failed: number };
        }>('/api/billing/generate-invoices', payload);

        setGenerateSuccess(
          `${result.message}. ${result.summary.successful} invoices generated successfully.`,
        );
      }

      // Refresh invoices list and related data
      setTimeout(async () => {
        try {
          const invoicesData = await apiGet<{ invoices: Invoice[] }>('/api/invoices');
          const invoicesList = invoicesData.invoices || [];
          setInvoices(invoicesList);
          setFilteredInvoices(invoicesList);
          await fetchRelatedData(invoicesList);
        } catch (err) {
          console.error('Failed to refresh invoices', err);
        }
      }, 1000);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  }

  async function refreshInvoices() {
    try {
      const invoicesData = await apiGet<{ invoices: Invoice[] }>('/api/invoices');
      const invoicesList = invoicesData.invoices || [];
      setInvoices(invoicesList);
      setFilteredInvoices(invoicesList);

      // Refresh related data using helper function
      await fetchRelatedData(invoicesList);
    } catch (err) {
      console.error('Failed to refresh invoices', err);
    }
  }

  return (
    <DashboardPage
      title="Invoices"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Invoices', href: '/org/invoices' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoices
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredInvoices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {invoices.length} total in system
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid Invoices
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {paidInvoices.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(paidAmount)} collected
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue Invoices
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {overdueInvoices.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(overdueAmount)} outstanding
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Amount
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1">All invoices (filtered)</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Invoice Management</CardTitle>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setIsGenerateOpen(true)} className="w-full sm:w-auto">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Invoice
                </Button>
                <Button
                  onClick={handleGenerateMonthly}
                  disabled={isGeneratingMonthly}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {isGeneratingMonthly ? 'Generating...' : 'Generate Monthly'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by invoice number, tenant name, building, or unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchTerm('');
                    }}
                    className="flex-shrink-0"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Section */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading invoices...</p>
                  </div>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {invoices.length === 0
                      ? 'No invoices found. Invoices will appear here once created.'
                      : 'No invoices match your filters.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const tenant = tenants[invoice.tenantId];
                      const unit = units[invoice.unitId];
                      const building = unit ? buildings[unit.buildingId] : null;
                      const overdue = isOverdue(invoice);

                      return (
                        <TableRow key={invoice._id}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            {tenant ? (
                              <Link
                                href={`/admin/tenants/${tenant._id}`}
                                className="hover:text-primary transition-colors"
                              >
                                {tenant.firstName} {tenant.lastName}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </TableCell>
                          <TableCell>
                            {unit ? (
                              <Link
                                href={`/admin/units/${unit._id}`}
                                className="hover:text-primary transition-colors"
                              >
                                {unit.unitNumber}
                              </Link>
                            ) : (
                              'Unknown'
                            )}
                          </TableCell>
                          <TableCell>
                            {building ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {building.name}
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {new Date(invoice.dueDate).toLocaleDateString()}
                              {overdue && <AlertCircle className="h-3 w-3 text-destructive" />}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(invoice.total)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={overdue ? 'destructive' : getStatusVariant(invoice.status)}
                            >
                              {overdue ? 'Overdue' : invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/org/invoices/${invoice._id}`}>
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
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Invoice Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>
              Select a tenant first to view their payment status and active leases, then generate an
              invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {generateError && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                {generateError}
              </div>
            )}
            {generateSuccess && (
              <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-4 rounded-lg">
                {generateSuccess}
              </div>
            )}

            <div>
              <Label>Generation Mode</Label>
              <Select
                value={generateMode}
                onValueChange={(value) => {
                  setGenerateMode(value as 'single' | 'batch');
                  if (value === 'batch') {
                    setSelectedTenantId('');
                    setSelectedLeaseId('');
                    setTenantPaymentStatus(null);
                    setTenantLeases([]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Invoice (Select Tenant)</SelectItem>
                  <SelectItem value="batch">Batch Generate (All Active Leases)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generateMode === 'single' && (
              <>
                {/* Step 1: Select Tenant */}
                <div>
                  <Label htmlFor="tenantSelect">Select Tenant *</Label>
                  <Select
                    value={selectedTenantId}
                    onValueChange={(value) => {
                      setSelectedTenantId(value);
                      setSelectedLeaseId(''); // Reset lease selection when tenant changes
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTenants.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No active tenants found
                        </div>
                      ) : (
                        allTenants.map((tenant) => (
                          <SelectItem key={tenant._id} value={tenant._id}>
                            {tenant.firstName} {tenant.lastName}
                            {tenant.primaryPhone && ` - ${tenant.primaryPhone}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Show Payment Status */}
                {selectedTenantId && isLoadingTenantData && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading payment status...
                    </span>
                  </div>
                )}

                {selectedTenantId && tenantPaymentStatus && !isLoadingTenantData && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Payment Status</h4>
                      {(tenantPaymentStatus.unpaidInvoices.count > 0 ||
                        tenantPaymentStatus.overdueInvoices.count > 0 ||
                        !tenantPaymentStatus.previousMonth.paid) && (
                        <Badge variant="destructive">Warning</Badge>
                      )}
                    </div>

                    {tenantPaymentStatus.unpaidInvoices.count > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
                        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                          Unpaid Invoices: {tenantPaymentStatus.unpaidInvoices.count} (
                          {formatCurrency(tenantPaymentStatus.unpaidInvoices.totalAmount)})
                        </p>
                        {tenantPaymentStatus.unpaidInvoices.invoices.length > 0 && (
                          <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                            {tenantPaymentStatus.unpaidInvoices.invoices
                              .slice(0, 3)
                              .map((inv: any) => (
                                <li key={inv._id}>
                                  {inv.invoiceNumber}: {formatCurrency(inv.total)} (Due:{' '}
                                  {new Date(inv.dueDate).toLocaleDateString()})
                                </li>
                              ))}
                            {tenantPaymentStatus.unpaidInvoices.invoices.length > 3 && (
                              <li>
                                ...and {tenantPaymentStatus.unpaidInvoices.invoices.length - 3} more
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )}

                    {tenantPaymentStatus.overdueInvoices.count > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">
                          Overdue Invoices: {tenantPaymentStatus.overdueInvoices.count} (
                          {formatCurrency(tenantPaymentStatus.overdueInvoices.totalAmount)})
                        </p>
                      </div>
                    )}

                    {!tenantPaymentStatus.previousMonth.paid && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3">
                        <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                          Previous month invoice not paid (
                          {tenantPaymentStatus.previousMonth.unpaidCount} unpaid)
                        </p>
                      </div>
                    )}

                    {tenantPaymentStatus.unpaidInvoices.count === 0 &&
                      tenantPaymentStatus.overdueInvoices.count === 0 &&
                      tenantPaymentStatus.previousMonth.paid && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            All payments up to date
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {/* Step 3: Select Lease */}
                {selectedTenantId && tenantLeases.length > 0 && (
                  <div>
                    <Label htmlFor="leaseSelect">Select Lease *</Label>
                    <Select value={selectedLeaseId} onValueChange={setSelectedLeaseId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lease" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenantLeases.map((lease) => {
                          const unit = units[lease.unitId];
                          return (
                            <SelectItem key={lease._id} value={lease._id}>
                              {unit ? unit.unitNumber : 'Unit'} - {formatCurrency(lease.rentAmount)}{' '}
                              / {lease.billingCycle}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedTenantId && tenantLeases.length === 0 && !isLoadingTenantData && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      No active leases found for this tenant. Please create an active lease first.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="periodStart">Period Start *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {generateMode === 'single'
                    ? 'Optional: Leave empty for current period'
                    : 'Start date of billing period'}
                </p>
              </div>
              <div>
                <Label htmlFor="periodEnd">Period End *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required={generateMode === 'batch'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {generateMode === 'single'
                    ? 'Optional: Leave empty for current period'
                    : 'End date of billing period'}
                </p>
              </div>
            </div>

            {generateMode === 'batch' && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This will generate invoices for all active leases in the selected period. Existing
                  invoices for the same period will be skipped unless you force regenerate.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateInvoice}
              disabled={
                isGenerating ||
                (generateMode === 'single' && (!selectedTenantId || !selectedLeaseId)) ||
                (generateMode === 'batch' && (!periodStart || !periodEnd))
              }
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
