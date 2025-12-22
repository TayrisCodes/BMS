'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPatch, apiDelete } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  Receipt,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Download,
  Zap,
  Droplet,
  Flame,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { UtilityType } from '@/lib/utilities/utility-payments';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

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
  createdBy?: string | null;
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

export default function UtilityPaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<UtilityPayment | null>(null);
  const [meter, setMeter] = useState<Meter | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchPaymentData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch payment
        const paymentData = await apiGet<{ utilityPayment: UtilityPayment }>(
          `/api/utility-payments/${paymentId}`,
        );
        setPayment(paymentData.utilityPayment);

        // Fetch meter and building
        if (paymentData.utilityPayment.meterId) {
          try {
            const meterData = await apiGet<{ meter: Meter }>(
              `/api/meters/${paymentData.utilityPayment.meterId}`,
            );
            setMeter(meterData.meter);

            if (meterData.meter.buildingId) {
              try {
                const buildingData = await apiGet<{ building: Building }>(
                  `/api/buildings/${meterData.meter.buildingId}`,
                );
                setBuilding(buildingData.building);
              } catch (err) {
                console.warn('Failed to fetch building:', err);
              }
            }
          } catch (err) {
            console.warn('Failed to fetch meter:', err);
          }
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

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiDelete(`/api/utility-payments/${paymentId}`);
      router.push('/org/utilities/payments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment');
      setIsDeleting(false);
      setDeleteModalOpen(false);
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
      month: 'long',
      day: 'numeric',
    });
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Utility Payment Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Utilities', href: '/org/meters' },
          { label: 'Payments', href: '/org/utilities/payments' },
          { label: 'Details', href: '#' },
        ]}
      >
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
      <DashboardPage
        title="Utility Payment Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Utilities', href: '/org/meters' },
          { label: 'Payments', href: '/org/utilities/payments' },
          { label: 'Details', href: '#' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Payment Not Found</h3>
                <p className="text-muted-foreground mb-4">
                  {error || 'The payment you are looking for does not exist.'}
                </p>
                <Button onClick={() => router.push('/org/utilities/payments')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Payments
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  const IconComponent = UTILITY_TYPE_ICONS[payment.utilityType];
  const isReceiptImage =
    payment.receiptFileName && !payment.receiptFileName.toLowerCase().endsWith('.pdf');

  return (
    <DashboardPage
      title="Utility Payment Details"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Utilities', href: '/org/meters' },
        { label: 'Payments', href: '/org/utilities/payments' },
        { label: 'Details', href: '#' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push('/org/utilities/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Button>
          <div className="flex gap-2">
            <Link href={`/org/utilities/payments/${paymentId}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                  <IconComponent className="h-6 w-6 text-primary" />
                  {UTILITY_TYPE_LABELS[payment.utilityType]} Payment
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{payment.paymentMethod}</Badge>
                  {payment.receiptUrl && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Receipt Attached
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Payment Amount</p>
                <p className="text-3xl font-bold">{formatCurrency(payment.amount)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Meter</p>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{meter?.meterNumber || 'Unknown Meter'}</p>
                  </div>
                  {building && (
                    <p className="text-sm text-muted-foreground ml-6">{building.name}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Billing Period</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">
                      {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Payment Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{formatDate(payment.paymentDate)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Payment Method</p>
                  <p className="font-medium">
                    {payment.paymentMethod
                      .split('_')
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(' ')}
                  </p>
                </div>
                {payment.receiptFileName && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Receipt File</p>
                    <div className="flex items-center gap-2">
                      {isReceiptImage ? (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <p className="font-medium">{payment.receiptFileName}</p>
                    </div>
                  </div>
                )}
                {payment.createdAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Created At</p>
                    <p>{formatDate(payment.createdAt)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Display */}
        {payment.receiptUrl && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Receipt</CardTitle>
                <a href={payment.receiptUrl} download={payment.receiptFileName || 'receipt'}>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {isReceiptImage ? (
                <div className="border rounded-lg overflow-hidden">
                  <img src={payment.receiptUrl} alt="Payment receipt" className="w-full h-auto" />
                </div>
              ) : (
                <div className="border rounded-lg p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">PDF Receipt</p>
                  <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Open PDF
                    </Button>
                  </a>
                </div>
              )}
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
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Payment ID</p>
                <p className="font-mono">{payment._id}</p>
              </div>
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

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Utility Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this utility payment record? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
