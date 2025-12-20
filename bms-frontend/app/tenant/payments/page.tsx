'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { BottomSheet } from '@/lib/components/ui/BottomSheet';
import { Button } from '@/lib/components/ui/button';
import { Download, ArrowRight, Loader2, Filter, Calendar } from 'lucide-react';
import { Badge } from '@/lib/components/ui/badge';
import { MobileForm, MobileFormField } from '@/lib/components/tenant/MobileForm';
import { ListItemSkeleton } from '@/lib/components/tenant/LoadingSkeleton';
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';

interface Payment {
  id: string;
  amount: number;
  invoiceNumber: string;
  method: string;
  status: string;
  createdAt: string;
  receiptUrl?: string;
}

export default function TenantPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline, queueAction } = useOfflineQueue();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [selectedInvoiceAmount, setSelectedInvoiceAmount] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);

  useEffect(() => {
    async function fetchPayments() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (dateRangeStart) params.set('startDate', dateRangeStart);
        if (dateRangeEnd) params.set('endDate', dateRangeEnd);
        if (methodFilter) params.set('method', methodFilter);
        if (statusFilter) params.set('status', statusFilter);

        const url = params.toString()
          ? `/api/tenant/payments?${params.toString()}`
          : '/api/tenant/payments';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const fetchedPayments = data.payments || data || [];
          setPayments(fetchedPayments);
          setFilteredPayments(fetchedPayments);
        } else {
          setPayments([]);
          setFilteredPayments([]);
        }
      } catch (error) {
        console.error('Failed to fetch payments:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();

    // Check if we need to open payment flow
    if (searchParams.get('action') === 'pay') {
      setIsPaymentSheetOpen(true);
      const invoiceId = searchParams.get('invoice');
      setSelectedInvoice(invoiceId);

      // If invoice ID is provided, fetch invoice details to get amount
      if (invoiceId) {
        fetchInvoiceDetails(invoiceId);
      }
    }
  }, [searchParams, dateRangeStart, dateRangeEnd, methodFilter, statusFilter]);

  async function fetchInvoiceDetails(invoiceId: string) {
    try {
      const response = await fetch(`/api/tenant/invoices/${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.invoice?.total) {
          setSelectedInvoiceAmount(data.invoice.total);
        }
      }
    } catch (error) {
      console.error('Failed to fetch invoice details:', error);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  };

  const handlePayNow = () => {
    setIsPaymentSheetOpen(true);
    setSelectedInvoice(null);
    setSelectedInvoiceAmount(null);
    setPaymentAmount('');
    setPaymentInstructions(null);
    setPaymentError(null);
  };

  const handlePaymentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setPaymentError(null);
    setPaymentInstructions(null);

    let amount: number = 0;
    let provider: string = '';

    try {
      const formData = new FormData(e.currentTarget);
      const paymentMethod = formData.get('paymentMethod') as string;
      amount = parseFloat(formData.get('amount') as string);

      if (!amount || amount <= 0) {
        setPaymentError('Please enter a valid amount');
        setIsProcessing(false);
        return;
      }

      if (!paymentMethod) {
        setPaymentError('Please select a payment method');
        setIsProcessing(false);
        return;
      }

      // Map UI payment method values to API provider values
      const providerMap: Record<string, string> = {
        telebirr: 'telebirr',
        'cbe-birr': 'cbe_birr',
        chapa: 'chapa',
        hellocash: 'hellocash',
        'bank-transfer': 'bank_transfer',
      };

      provider = providerMap[paymentMethod] || paymentMethod;

      const paymentData = {
        invoiceId: selectedInvoice || null,
        amount,
        provider,
      };

      // If offline, queue the payment
      if (!isOnline) {
        queueAction('payment', paymentData);
        alert(
          "You're offline. Your payment has been queued and will be processed when you're back online.",
        );
        setIsPaymentSheetOpen(false);
        setIsProcessing(false);
        return;
      }

      // Create payment intent
      const response = await fetch('/api/tenant/payments/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
        setPaymentError(data.error || 'Failed to initiate payment. Please try again.');
        setIsProcessing(false);
        return;
      }

      // If redirect URL is provided, redirect user
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      // If payment instructions are provided, show them
      if (data.paymentInstructions) {
        setPaymentInstructions(data.paymentInstructions);
        setIsProcessing(false);
        // Keep the sheet open to show instructions
        return;
      }

      // If neither redirect nor instructions, show success message
      alert(`Payment intent created successfully. Reference: ${data.referenceNumber || 'N/A'}`);
      setIsPaymentSheetOpen(false);
      // Refresh payments list
      window.location.reload();
    } catch (error) {
      console.error('Payment submission error:', error);

      // If network error and offline, queue the payment
      if (!isOnline || (error instanceof Error && error.message.includes('fetch'))) {
        const paymentData = {
          invoiceId: selectedInvoice || null,
          amount,
          provider,
        };
        queueAction('payment', paymentData);
        alert(
          "You're offline. Your payment has been queued and will be processed when you're back online.",
        );
        setIsPaymentSheetOpen(false);
        setIsProcessing(false);
        return;
      }

      setPaymentError('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pay Now Button */}
      <Button className="w-full h-14 text-base font-medium" onClick={handlePayNow}>
        Pay Now
      </Button>

      {/* Payment Bottom Sheet */}
      <BottomSheet
        isOpen={isPaymentSheetOpen}
        onClose={() => {
          setIsPaymentSheetOpen(false);
          setPaymentInstructions(null);
          setPaymentError(null);
          router.replace('/tenant/payments');
        }}
        title="Make Payment"
      >
        {paymentInstructions ? (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-muted">
              <h3 className="font-semibold mb-2">Payment Instructions</h3>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {paymentInstructions}
              </pre>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setIsPaymentSheetOpen(false);
                setPaymentInstructions(null);
                router.replace('/tenant/payments');
                window.location.reload();
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          <MobileForm
            onSubmit={handlePaymentSubmit}
            submitLabel={isProcessing ? 'Processing...' : 'Process Payment'}
          >
            <div className="space-y-4">
              {paymentError && (
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{paymentError}</p>
                </div>
              )}

              {selectedInvoice && (
                <div className="p-4 rounded-md bg-muted">
                  <p className="text-sm text-muted-foreground">Paying for Invoice</p>
                  <p className="font-semibold">{selectedInvoice}</p>
                  {selectedInvoiceAmount && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Amount: {formatCurrency(selectedInvoiceAmount)}
                    </p>
                  )}
                </div>
              )}

              <MobileFormField
                label="Amount"
                name="amount"
                type="number"
                placeholder="Enter amount"
                required
                value={selectedInvoiceAmount ? selectedInvoiceAmount.toString() : paymentAmount}
                onChange={(e) => {
                  if (!selectedInvoiceAmount) {
                    setPaymentAmount(e.target.value);
                  }
                }}
              />

              <div className="space-y-2">
                <label htmlFor="paymentMethod" className="text-base font-medium">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  required
                  disabled={isProcessing}
                  className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select payment method</option>
                  <option value="telebirr">Telebirr</option>
                  <option value="cbe-birr">CBE Birr</option>
                  <option value="chapa">Chapa</option>
                  <option value="hellocash">HelloCash</option>
                  <option value="bank-transfer">Bank Transfer</option>
                </select>
              </div>

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Initiating payment...</span>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {isProcessing
                  ? 'Please wait while we process your payment...'
                  : 'You will be redirected to complete the payment securely.'}
              </p>
            </div>
          </MobileForm>
        )}
      </BottomSheet>

      {/* Payment History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payment History</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const params = new URLSearchParams();
                if (dateRangeStart) params.set('startDate', dateRangeStart);
                if (dateRangeEnd) params.set('endDate', dateRangeEnd);
                if (methodFilter) params.set('method', methodFilter);
                if (statusFilter) params.set('status', statusFilter);
                params.set('format', 'csv');

                const response = await fetch(`/api/tenant/payments/export?${params.toString()}`);
                if (response.ok) {
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } else {
                  alert('Failed to export payments. Please try again.');
                }
              } catch (error) {
                console.error('Export error:', error);
                alert('Failed to export payments. Please try again.');
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="dateStart" className="text-xs text-muted-foreground">
                Start Date
              </label>
              <input
                id="dateStart"
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="dateEnd" className="text-xs text-muted-foreground">
                End Date
              </label>
              <input
                id="dateEnd"
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Method and Status Filters */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="methodFilter" className="text-xs text-muted-foreground">
                Payment Method
              </label>
              <select
                id="methodFilter"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Methods</option>
                <option value="telebirr">Telebirr</option>
                <option value="cbe_birr">CBE Birr</option>
                <option value="chapa">Chapa</option>
                <option value="hellocash">HelloCash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="statusFilter" className="text-xs text-muted-foreground">
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {(dateRangeStart || dateRangeEnd || methodFilter || statusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateRangeStart('');
                setDateRangeEnd('');
                setMethodFilter('');
                setStatusFilter('');
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
          )}
        </div>
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : (
          <MobileList
            items={filteredPayments}
            loading={false}
            emptyMessage={
              dateRangeStart || dateRangeEnd || methodFilter || statusFilter
                ? 'No payments match your filters'
                : 'No payments yet'
            }
            renderItem={(payment) => (
              <MobileCard className="border-0 border-b rounded-none">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold">{formatCurrency(payment.amount)}</div>
                      <div className="text-sm text-muted-foreground">
                        Invoice {payment.invoiceNumber}
                      </div>
                    </div>
                    <Badge variant="default">{payment.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()} • {payment.method}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/tenant/invoices/${payment.invoiceNumber}`)}
                      >
                        View Invoice
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                      {payment.receiptUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(payment.receiptUrl, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </MobileCard>
            )}
          />
        )}
      </div>
    </div>
  );
}
