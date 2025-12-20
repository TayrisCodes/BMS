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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  CreditCard,
  Eye,
  Search,
  Calendar,
  DollarSign,
  Filter,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Download,
  X,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface Payment {
  _id: string;
  invoiceId?: string | null;
  tenantId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string | null;
  status: string;
  providerResponse?: Record<string, unknown> | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
}

export default function OrgPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Record<string, Tenant>>({});
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function to fetch related data (tenants, invoices)
  async function fetchRelatedData(paymentsList: Payment[]) {
    const tenantIds = [...new Set(paymentsList.map((p) => p.tenantId).filter(Boolean))];
    const invoiceIds = [
      ...new Set(paymentsList.map((p) => p.invoiceId).filter(Boolean) as string[]),
    ];

    const tenantMap: Record<string, Tenant> = {};
    const invoiceMap: Record<string, Invoice> = {};

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

    // Fetch all invoices in parallel
    if (invoiceIds.length > 0) {
      const invoicePromises = invoiceIds.map(async (invoiceId) => {
        try {
          const invoiceData = await apiGet<{ invoice: Invoice }>(`/api/invoices/${invoiceId}`);
          return { invoiceId, invoice: invoiceData.invoice };
        } catch (err) {
          console.warn(`Failed to fetch invoice ${invoiceId}:`, err);
          return null;
        }
      });

      const invoiceResults = await Promise.all(invoicePromises);
      invoiceResults.forEach((result) => {
        if (result) {
          invoiceMap[result.invoiceId] = result.invoice;
        }
      });
    }

    setTenants(tenantMap);
    setInvoices(invoiceMap);
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const paymentsData = await apiGet<{ payments: Payment[] }>('/api/payments');
        const paymentsList = paymentsData.payments || [];
        setPayments(paymentsList);
        setFilteredPayments(paymentsList);

        // Fetch related data using helper function
        await fetchRelatedData(paymentsList);
      } catch (err) {
        console.error('Failed to load payments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load payments');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = payments;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Apply payment method filter
    if (methodFilter !== 'all') {
      filtered = filtered.filter((p) => p.paymentMethod === methodFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter((p) => {
        const tenant = tenants[p.tenantId];
        const invoice = p.invoiceId ? invoices[p.invoiceId] : null;

        return (
          (p.referenceNumber && p.referenceNumber.toLowerCase().includes(query)) ||
          (tenant && `${tenant.firstName} ${tenant.lastName}`.toLowerCase().includes(query)) ||
          (invoice && invoice.invoiceNumber.toLowerCase().includes(query)) ||
          p.paymentMethod.toLowerCase().includes(query)
        );
      });
    }

    setFilteredPayments(filtered);
  }, [statusFilter, methodFilter, searchTerm, payments, tenants, invoices]);

  const completedPayments = filteredPayments.filter((p) => p.status === 'completed');
  const pendingPayments = filteredPayments.filter((p) => p.status === 'pending');
  const failedPayments = filteredPayments.filter((p) => p.status === 'failed');
  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const completedAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);

  const hasActiveFilters = statusFilter !== 'all' || methodFilter !== 'all' || searchTerm !== '';

  function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'refunded':
        return 'outline';
      default:
        return 'outline';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'refunded':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return null;
    }
  }

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

  function formatPaymentMethod(method: string): string {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
            <div className="space-y-2">
              <p className="text-lg font-medium">Loading payments...</p>
              <p className="text-sm text-muted-foreground">Please wait while we fetch your data</p>
            </div>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (error) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Error loading payments</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Manage and track all payment transactions</p>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Payments
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredPayments.length}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                <span>{payments.length} total in system</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-xs">
                    Filtered
                  </Badge>
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Amount
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totalAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                {completedPayments.length} completed payments
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed Amount
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(completedAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedPayments.length} successful transactions
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Payments
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingPayments.length}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {failedPayments.length > 0 ? (
                  <>
                    <XCircle className="h-3 w-3 text-destructive" />
                    {failedPayments.length} failed
                  </>
                ) : (
                  <span>All clear</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle>Filters & Search</CardTitle>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setMethodFilter('all');
                    setSearchTerm('');
                  }}
                  className="text-xs h-8"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
            <CardDescription>
              Search and filter payments by status, method, or keywords
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  placeholder="Search by reference, tenant name, invoice number, or payment method..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 w-full"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-3 w-3" />
                    Status
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder="Filter by method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="telebirr">Telebirr</SelectItem>
                      <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                      <SelectItem value="chapa">Chapa</SelectItem>
                      <SelectItem value="hellocash">HelloCash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle>Payment Transactions</CardTitle>
                <CardDescription className="mt-1">
                  {filteredPayments.length} {filteredPayments.length === 1 ? 'payment' : 'payments'}{' '}
                  found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                  <CreditCard className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No payments found</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more results.'
                    : 'No payments have been recorded yet. Payments will appear here once they are processed.'}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusFilter('all');
                      setMethodFilter('all');
                      setSearchTerm('');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Tenant</TableHead>
                        <TableHead className="font-semibold">Invoice</TableHead>
                        <TableHead className="font-semibold text-right">Amount</TableHead>
                        <TableHead className="font-semibold">Method</TableHead>
                        <TableHead className="font-semibold">Reference</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => {
                        const tenant = tenants[payment.tenantId];
                        const invoice = payment.invoiceId ? invoices[payment.invoiceId] : null;
                        const isCompleted = payment.status === 'completed';

                        return (
                          <TableRow
                            key={payment._id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="font-medium whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>{formatDate(payment.paymentDate)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="font-medium">
                                {tenant
                                  ? `${tenant.firstName} ${tenant.lastName}`
                                  : `Tenant ${payment.tenantId.slice(-6)}`}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {invoice ? (
                                <Link
                                  href={`/org/invoices/${payment.invoiceId}`}
                                  className="text-primary hover:underline font-medium inline-flex items-center gap-1 group"
                                >
                                  {invoice.invoiceNumber}
                                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {isCompleted && (
                                  <ArrowDownRight className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                                )}
                                <span
                                  className={`font-bold ${isCompleted ? 'text-green-600 dark:text-green-400' : ''}`}
                                >
                                  {formatCurrency(payment.amount)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="outline" className="font-normal">
                                {formatPaymentMethod(payment.paymentMethod)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {payment.referenceNumber ? (
                                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                  {payment.referenceNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={getStatusVariant(payment.status)}
                                className="font-medium"
                              >
                                <span className="flex items-center gap-1.5">
                                  {getStatusIcon(payment.status)}
                                  <span className="capitalize">{payment.status}</span>
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Link href={`/org/payments/${payment._id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-primary/10 hover:text-primary"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">View details</span>
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
