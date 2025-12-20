'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  CreditCard,
  ArrowLeft,
  FileText,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
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

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  dueDate: string;
  issueDate: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
  email?: string;
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPaymentData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch payment
        const paymentData = await apiGet<{ payment: Payment }>(`/api/payments/${paymentId}`);
        const paymentObj = paymentData.payment;
        setPayment(paymentObj);

        // Fetch related data in parallel
        const [tenantData, invoiceData] = await Promise.all([
          apiGet<{ tenant: Tenant }>(`/api/tenants/${paymentObj.tenantId}`).catch(() => null),
          paymentObj.invoiceId
            ? apiGet<{ invoice: Invoice }>(`/api/invoices/${paymentObj.invoiceId}`).catch(
                () => null,
              )
            : Promise.resolve(null),
        ]);

        if (tenantData) {
          setTenant(tenantData.tenant);
        }

        if (invoiceData) {
          setInvoice(invoiceData.invoice);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment');
      } finally {
        setIsLoading(false);
      }
    }

    if (paymentId) {
      fetchPaymentData();
    }
  }, [paymentId]);

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
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatPaymentMethod(method: string): string {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

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

  async function handleReconcilePayment() {
    if (!payment) return;

    setIsReconciling(true);
    setReconcileError(null);
    setReconcileSuccess(null);

    try {
      const response = await apiPatch<{ message: string; payment: Payment }>(
        `/api/payments/${paymentId}/reconcile`,
        {},
      );

      // Update payment state with reconciled payment
      setPayment(response.payment);
      setReconcileSuccess('Payment reconciled successfully');

      // Refresh invoice if it exists
      if (payment.invoiceId) {
        try {
          const invoiceData = await apiGet<{ invoice: Invoice }>(
            `/api/invoices/${payment.invoiceId}`,
          );
          setInvoice(invoiceData.invoice);
        } catch (err) {
          console.warn('Failed to refresh invoice:', err);
        }
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        setReconcileSuccess(null);
      }, 5000);
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : 'Failed to reconcile payment');
      console.error('Reconcile payment error:', err);
    } finally {
      setIsReconciling(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading payment...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (error || !payment) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Error loading payment</p>
            <p className="text-muted-foreground mb-4">{error || 'Payment not found'}</p>
            <Button onClick={() => router.push('/org/payments')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Payments
            </Button>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/org/payments')} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Payment Details</h1>
              <p className="text-sm text-muted-foreground">Payment ID: {payment._id.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={getStatusVariant(payment.status)} className="text-sm px-3 py-1">
              <span className="flex items-center gap-1">
                {getStatusIcon(payment.status)}
                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              </span>
            </Badge>
            {payment.status === 'pending' && (
              <Button onClick={handleReconcilePayment} disabled={isReconciling} variant="default">
                {isReconciling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Reconcile Payment
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Reconcile Success/Error Messages */}
        {reconcileSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">{reconcileSuccess}</p>
            </div>
          </div>
        )}
        {reconcileError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">Failed to reconcile payment</p>
            </div>
            <p className="text-sm text-destructive mt-1">{reconcileError}</p>
          </div>
        )}

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-2">Payment Amount</p>
              <p className="text-4xl font-bold">{formatCurrency(payment.amount)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Related Invoice */}
        {invoice && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Related Invoice
                </CardTitle>
                <Link href={`/org/invoices/${payment.invoiceId}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Invoice
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Invoice Number</p>
                  <p className="font-semibold">{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Invoice Total</p>
                  <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Invoice Status</p>
                  <Badge
                    variant={
                      invoice.status === 'paid'
                        ? 'default'
                        : invoice.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                  <p>{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Payment Date</p>
                <p className="font-medium">{formatDate(payment.paymentDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                <p className="font-medium">{formatPaymentMethod(payment.paymentMethod)}</p>
              </div>
              {payment.referenceNumber && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reference Number</p>
                  <p className="font-mono text-sm">{payment.referenceNumber}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={getStatusVariant(payment.status)}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(payment.status)}
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Information */}
        {tenant && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Tenant Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tenant Name</p>
                  <p className="font-medium">
                    {tenant.firstName} {tenant.lastName}
                  </p>
                </div>
                {tenant.primaryPhone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone</p>
                    <p>{tenant.primaryPhone}</p>
                  </div>
                )}
                {tenant.email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p>{tenant.email}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Provider Response */}
        {payment.providerResponse && Object.keys(payment.providerResponse).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Provider Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                {JSON.stringify(payment.providerResponse, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {payment.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{payment.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Payment ID</p>
                <p className="font-mono">{payment._id}</p>
              </div>
              {payment.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created At</p>
                  <p>{formatDate(payment.createdAt)}</p>
                </div>
              )}
              {payment.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{formatDate(payment.updatedAt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
