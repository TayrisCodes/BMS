'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  FileText,
  ArrowLeft,
  Building2,
  User,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  Plus,
  ExternalLink,
  Zap,
  Send,
  Loader2,
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
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
  email?: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
}

interface Building {
  _id: string;
  name: string;
  address?: string;
}

interface Lease {
  _id: string;
  tenantId: string;
  unitId: string;
  rentAmount: number;
  billingCycle: string;
  status: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitiatingChapa, setIsInitiatingChapa] = useState(false);
  const [chapaError, setChapaError] = useState<string | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [sendInvoiceSuccess, setSendInvoiceSuccess] = useState<string | null>(null);
  const [sendInvoiceError, setSendInvoiceError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoiceData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch invoice
        const invoiceData = await apiGet<{ invoice: Invoice }>(`/api/invoices/${invoiceId}`);
        const invoiceObj = invoiceData.invoice;
        setInvoice(invoiceObj);

        // Fetch related data in parallel
        const [tenantData, unitData, leaseData] = await Promise.all([
          apiGet<{ tenant: Tenant }>(`/api/tenants/${invoiceObj.tenantId}`).catch(() => null),
          apiGet<{ unit: Unit }>(`/api/units/${invoiceObj.unitId}`).catch(() => null),
          apiGet<{ lease: Lease }>(`/api/leases/${invoiceObj.leaseId}`).catch(() => null),
        ]);

        if (tenantData) {
          setTenant(tenantData.tenant);
        }

        if (unitData) {
          setUnit(unitData.unit);
          // Fetch building if unit is found
          if (unitData.unit.buildingId) {
            try {
              const buildingData = await apiGet<{ building: Building }>(
                `/api/buildings/${unitData.unit.buildingId}`,
              );
              setBuilding(buildingData.building);
            } catch (err) {
              console.warn('Failed to fetch building:', err);
            }
          }
        }

        if (leaseData) {
          setLease(leaseData.lease);
        }

        // Fetch payments for this invoice
        try {
          setIsLoadingPayments(true);
          const paymentsData = await apiGet<{ payments: any[] }>(
            `/api/payments?invoiceId=${invoiceId}`,
          );
          setPayments(paymentsData.payments || []);
        } catch (err) {
          console.warn('Failed to fetch payments:', err);
        } finally {
          setIsLoadingPayments(false);
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
        if (err instanceof Error) {
          if (err.message.includes('404') || err.message.includes('not found')) {
            setError('Invoice not found');
          } else {
            setError(err.message);
          }
        } else {
          setError('Failed to load invoice');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (invoiceId) {
      fetchInvoiceData();
    }
  }, [invoiceId]);

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
      month: 'long',
      day: 'numeric',
    });
  }

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

  function getStatusIcon(status: string) {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      case 'draft':
        return <FileText className="h-4 w-4" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  }

  function isOverdue(): boolean {
    if (!invoice || invoice.status === 'paid') return false;
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  async function handlePayWithChapa() {
    if (!invoice) return;

    setIsInitiatingChapa(true);
    setChapaError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pay/chapa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Chapa payment');
      }

      if (data.redirectUrl) {
        // Redirect to Chapa checkout page
        window.location.href = data.redirectUrl;
      } else {
        // If no redirect URL, show payment instructions
        alert(data.paymentInstructions || 'Payment initiated. Please follow the instructions.');
      }
    } catch (err) {
      setChapaError(err instanceof Error ? err.message : 'Failed to initiate payment');
      console.error('Chapa payment initiation error:', err);
    } finally {
      setIsInitiatingChapa(false);
    }
  }

  function calculateRemainingBalance(): number {
    if (!invoice) return 0;
    const totalPaid = payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, invoice.total - totalPaid);
  }

  async function handleSendInvoice() {
    if (!invoice) return;

    setIsSendingInvoice(true);
    setSendInvoiceError(null);
    setSendInvoiceSuccess(null);

    try {
      const response = await apiPost<{ message: string; result: any }>(
        `/api/invoices/${invoiceId}/send`,
        {},
      );

      setSendInvoiceSuccess('Invoice sent successfully to tenant');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSendInvoiceSuccess(null);
      }, 5000);
    } catch (err) {
      setSendInvoiceError(err instanceof Error ? err.message : 'Failed to send invoice');
      console.error('Send invoice error:', err);
    } finally {
      setIsSendingInvoice(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Invoice Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Invoices', href: '/org/invoices' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading invoice...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardPage
        title="Invoice Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Invoices', href: '/org/invoices' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Invoice Not Found</h3>
                <p className="text-muted-foreground mb-4">
                  {error || 'The invoice you are looking for does not exist.'}
                </p>
                <Button onClick={() => router.push('/org/invoices')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  const overdue = isOverdue();

  return (
    <DashboardPage
      title="Invoice Details"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Invoices', href: '/org/invoices' },
        { label: invoice.invoiceNumber, href: '#' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push('/org/invoices')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
          {invoice.status !== 'paid' && (
            <Button onClick={handleSendInvoice} disabled={isSendingInvoice} variant="default">
              {isSendingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </>
              )}
            </Button>
          )}
        </div>

        {/* Send Invoice Success/Error Messages */}
        {sendInvoiceSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">{sendInvoiceSuccess}</p>
            </div>
          </div>
        )}
        {sendInvoiceError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">Failed to send invoice</p>
            </div>
            <p className="text-sm text-destructive mt-1">{sendInvoiceError}</p>
          </div>
        )}

        {/* Invoice Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">Invoice {invoice.invoiceNumber}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={overdue ? 'destructive' : getStatusVariant(invoice.status)}
                    className="flex items-center gap-1"
                  >
                    {getStatusIcon(overdue ? 'overdue' : invoice.status)}
                    {overdue
                      ? 'Overdue'
                      : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                  {invoice.paidAt && (
                    <span className="text-sm text-muted-foreground">
                      Paid on {formatDate(invoice.paidAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-3xl font-bold">{formatCurrency(invoice.total)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Issue Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{formatDate(invoice.issueDate)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Due Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className={`font-medium ${overdue ? 'text-destructive' : ''}`}>
                      {formatDate(invoice.dueDate)}
                    </p>
                    {overdue && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                {(invoice.periodStart || invoice.periodEnd) && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Billing Period</p>
                    <p className="font-medium">
                      {invoice.periodStart && formatDate(invoice.periodStart)} -{' '}
                      {invoice.periodEnd && formatDate(invoice.periodEnd)}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {tenant && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Tenant</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Link
                        href={`/admin/tenants/${tenant._id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {tenant.firstName} {tenant.lastName}
                      </Link>
                    </div>
                    {tenant.primaryPhone && (
                      <p className="text-sm text-muted-foreground ml-6">{tenant.primaryPhone}</p>
                    )}
                  </div>
                )}
                {unit && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Unit</p>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <Link
                        href={`/admin/units/${unit._id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {unit.unitNumber}
                      </Link>
                    </div>
                    {building && (
                      <p className="text-sm text-muted-foreground ml-6">{building.name}</p>
                    )}
                  </div>
                )}
                {lease && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Lease</p>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <Link
                        href={`/admin/leases/${lease._id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {formatCurrency(lease.rentAmount)} / {lease.billingCycle}
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">Status: {lease.status}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Items */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal (Before VAT)</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.tax && invoice.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT ({invoice.vatRate ?? 15}%)</span>
                    <span className="font-medium">{formatCurrency(invoice.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total (After VAT)</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
                {invoice.netIncomeBeforeVat !== null &&
                  invoice.netIncomeBeforeVat !== undefined && (
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Net Income (Before VAT)</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(invoice.netIncomeBeforeVat)}
                      </span>
                    </div>
                  )}
                {invoice.netIncomeAfterVat !== null && invoice.netIncomeAfterVat !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Net Income (After VAT)</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(invoice.netIncomeAfterVat)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Summary
              </CardTitle>
              <div className="flex gap-2">
                {calculateRemainingBalance() > 0 && (
                  <Button
                    onClick={handlePayWithChapa}
                    disabled={isInitiatingChapa}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isInitiatingChapa ? 'Processing...' : 'Pay with Chapa'}
                  </Button>
                )}
                <Button
                  onClick={() => router.push(`/org/payments/new?invoiceId=${invoiceId}`)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Invoice Total</p>
                <p className="text-2xl font-bold">{formatCurrency(invoice.total)}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    payments
                      .filter((p) => p.status === 'completed')
                      .reduce((sum, p) => sum + p.amount, 0),
                  )}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Remaining Balance</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(calculateRemainingBalance())}
                </p>
              </div>
            </div>

            {chapaError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm font-medium">Payment Error</p>
                </div>
                <p className="text-sm text-destructive mt-1">{chapaError}</p>
              </div>
            )}

            {isLoadingPayments ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 border rounded-lg">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium mb-1">No payments recorded</p>
                <p className="text-xs text-muted-foreground mb-4">
                  This invoice has not been paid yet
                </p>
                <Button
                  onClick={() => router.push(`/org/payments/new?invoiceId=${invoiceId}`)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Record First Payment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment._id}>
                          <TableCell className="font-medium">
                            {formatDate(payment.paymentDate)}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            {payment.paymentMethod
                              .split('_')
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(' ')}
                          </TableCell>
                          <TableCell>
                            {payment.referenceNumber ? (
                              <span className="font-mono text-sm">{payment.referenceNumber}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === 'completed'
                                  ? 'default'
                                  : payment.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/org/payments/${payment._id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice ID</p>
                <p className="font-mono">{invoice._id}</p>
              </div>
              {invoice.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created At</p>
                  <p>{formatDate(invoice.createdAt)}</p>
                </div>
              )}
              {invoice.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{formatDate(invoice.updatedAt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
