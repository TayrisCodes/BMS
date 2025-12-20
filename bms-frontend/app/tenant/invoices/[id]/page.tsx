'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { ArrowLeft, CreditCard, Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

interface Invoice {
  _id: string;
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
}

interface Payment {
  _id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string | null;
  status: string;
}

export default function TenantInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitiatingChapa, setIsInitiatingChapa] = useState(false);
  const [chapaError, setChapaError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoiceData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch invoice
        const invoiceData = await apiGet<{ invoice: Invoice }>(`/api/tenant/invoices/${invoiceId}`);
        setInvoice(invoiceData.invoice);

        // Fetch payments for this invoice
        try {
          const paymentsData = await apiGet<{ payments: Payment[] }>(
            `/api/tenant/payments?invoiceId=${invoiceId}`,
          );
          setPayments(paymentsData.payments || []);
        } catch (err) {
          console.warn('Failed to fetch payments:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    }

    if (invoiceId) {
      fetchInvoiceData();
    }
  }, [invoiceId]);

  async function handlePayWithChapa() {
    if (!invoice) return;

    setIsInitiatingChapa(true);
    setChapaError(null);

    try {
      const response = await fetch('/api/tenant/payments/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice._id,
          amount: calculateRemainingBalance(),
          provider: 'chapa',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Chapa payment');
      }

      if (data.redirectUrl) {
        // Redirect to Chapa checkout page
        window.location.href = data.redirectUrl;
      } else {
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
      case 'overdue':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-semibold mb-2">Error loading invoice</p>
          <p className="text-muted-foreground mb-4">{error || 'Invoice not found'}</p>
          <Button onClick={() => router.push('/tenant/invoices')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const remainingBalance = calculateRemainingBalance();
  const totalPaid = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  const isOverdue = invoice.status !== 'paid' && new Date(invoice.dueDate) < new Date();

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
        <Button onClick={() => router.back()} variant="ghost" size="icon">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Invoice {invoice.invoiceNumber}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={isOverdue ? 'destructive' : getStatusVariant(invoice.status)}>
              <span className="flex items-center gap-1">
                {getStatusIcon(isOverdue ? 'overdue' : invoice.status)}
                {isOverdue
                  ? 'Overdue'
                  : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Payment Summary Card */}
      <MobileCard className="m-4">
        <div className="space-y-4">
          <div className="text-center pb-4 border-b">
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-3xl font-bold">{formatCurrency(invoice.total)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remaining</p>
              <p className="text-lg font-semibold text-orange-600">
                {formatCurrency(remainingBalance)}
              </p>
            </div>
          </div>

          {remainingBalance > 0 && (
            <div className="pt-4 border-t space-y-2">
              {chapaError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-xs text-destructive">{chapaError}</p>
                </div>
              )}
              <Button
                onClick={handlePayWithChapa}
                disabled={isInitiatingChapa}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isInitiatingChapa ? 'Processing...' : 'Pay with Chapa'}
              </Button>
              <Button
                onClick={() => router.push(`/tenant/payments?invoice=${invoiceId}&action=pay`)}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Other Payment Methods
              </Button>
            </div>
          )}
        </div>
      </MobileCard>

      {/* Invoice Details */}
      <MobileCard className="m-4">
        <div className="space-y-4">
          <h2 className="font-semibold text-base">Invoice Details</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue Date</span>
              <span>{formatDate(invoice.issueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span>{formatDate(invoice.dueDate)}</span>
            </div>
            {invoice.periodStart && invoice.periodEnd && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period Start</span>
                  <span>{formatDate(invoice.periodStart)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period End</span>
                  <span>{formatDate(invoice.periodEnd)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </MobileCard>

      {/* Invoice Items */}
      <MobileCard className="m-4">
        <div className="space-y-4">
          <h2 className="font-semibold text-base">Items</h2>
          <div className="space-y-3">
            {invoice.items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-start pb-3 border-b last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t space-y-2">
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
            <div className="flex justify-between text-base font-bold pt-2 border-t">
              <span>Total (After VAT)</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </MobileCard>

      {/* Payments */}
      {payments.length > 0 && (
        <MobileCard className="m-4">
          <div className="space-y-4">
            <h2 className="font-semibold text-base">Payments</h2>
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment._id}
                  className="flex justify-between items-center pb-3 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.paymentDate)} •{' '}
                      {payment.paymentMethod
                        .split('_')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                    </p>
                    {payment.referenceNumber && (
                      <p className="text-xs font-mono text-muted-foreground">
                        {payment.referenceNumber}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      payment.status === 'completed'
                        ? 'default'
                        : payment.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </MobileCard>
      )}
    </div>
  );
}

