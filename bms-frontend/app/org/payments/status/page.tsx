'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

export default function PaymentStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txRef = searchParams.get('tx_ref');
  const intentId = searchParams.get('intent_id');

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkPaymentStatus() {
      if (!txRef && !intentId) {
        setError('Missing payment reference');
        setStatus('failed');
        return;
      }

      try {
        // If we have intentId, check payment intent status
        if (intentId) {
          const intentData = await apiGet<{ intent: any }>(`/api/payment-intents/${intentId}`);
          const intent = intentData.intent;

          if (intent.status === 'completed') {
            setStatus('success');
            setPaymentData({
              referenceNumber: intent.referenceNumber,
              amount: intent.amount,
              invoiceId: intent.invoiceId,
            });
          } else if (intent.status === 'failed') {
            setStatus('failed');
            setError('Payment failed');
          } else {
            setStatus('pending');
          }
        } else if (txRef) {
          // Try to find payment by reference
          // This would require a new API endpoint or we can check via payment intents
          setStatus('pending');
        }
      } catch (err) {
        console.error('Payment status check error:', err);
        setError(err instanceof Error ? err.message : 'Failed to check payment status');
        setStatus('failed');
      }
    }

    checkPaymentStatus();
  }, [txRef, intentId]);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <DashboardPage>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status === 'loading' && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Checking payment status...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Your payment has been processed successfully.
                </p>
                {paymentData && (
                  <div className="bg-muted p-4 rounded-lg mb-6 text-left">
                    <div className="space-y-2">
                      {paymentData.referenceNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reference:</span>
                          <span className="font-mono">{paymentData.referenceNumber}</span>
                        </div>
                      )}
                      {paymentData.amount && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-semibold">
                            {formatCurrency(paymentData.amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-3 justify-center">
                  {paymentData?.invoiceId && (
                    <Link href={`/org/invoices/${paymentData.invoiceId}`}>
                      <Button>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        View Invoice
                      </Button>
                    </Link>
                  )}
                  <Link href="/org/payments">
                    <Button variant="outline">View All Payments</Button>
                  </Link>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="text-center py-8">
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
                <p className="text-muted-foreground mb-6">
                  {error || 'Your payment could not be processed. Please try again.'}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                  </Button>
                  <Link href="/org/invoices">
                    <Button>View Invoices</Button>
                  </Link>
                </div>
              </div>
            )}

            {status === 'pending' && (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Payment Pending</h2>
                <p className="text-muted-foreground mb-6">
                  Your payment is being processed. Please wait a moment and refresh this page.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => window.location.reload()} variant="outline">
                    Refresh Status
                  </Button>
                  <Link href="/org/payments">
                    <Button variant="outline">View Payments</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardPage>
  );
}
