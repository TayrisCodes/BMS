'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileCard } from '@/lib/components/tenant/MobileCard';
import { MobileList } from '@/lib/components/tenant/MobileList';
import { BottomSheet } from '@/lib/components/ui/BottomSheet';
import { Button } from '@/lib/components/ui/button';
import { Download, ArrowRight, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    async function fetchPayments() {
      try {
        setLoading(true);
        const response = await fetch('/api/tenant/payments');
        if (response.ok) {
          const data = await response.json();
          setPayments(data.payments || data || []);
        } else {
          setPayments([]);
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
  }, [searchParams]);

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
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Payment History</h2>
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : (
          <MobileList
            items={payments}
            loading={false}
            emptyMessage="No payments yet"
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
