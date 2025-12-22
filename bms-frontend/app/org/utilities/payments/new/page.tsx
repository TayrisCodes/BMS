'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Textarea } from '@/lib/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import {
  ArrowLeft,
  Receipt,
  Save,
  AlertCircle,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import type { UtilityType } from '@/lib/utilities/utility-payments';

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

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'cbe_birr', label: 'CBE Birr' },
  { value: 'chapa', label: 'Chapa' },
  { value: 'hellocash', label: 'HelloCash' },
  { value: 'other', label: 'Other' },
];

export default function NewUtilityPaymentPage() {
  const router = useRouter();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [buildings, setBuildings] = useState<Record<string, Building>>({});
  const [selectedUtilityType, setSelectedUtilityType] = useState<UtilityType | ''>('');
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [metersData, buildingsData] = await Promise.all([
          apiGet<{ meters: Meter[] }>('/api/meters').catch(() => ({ meters: [] })),
          apiGet<{ buildings: Building[] }>('/api/buildings').catch(() => ({ buildings: [] })),
        ]);

        setMeters(metersData.meters || []);
        const buildingsMap: Record<string, Building> = {};
        (buildingsData.buildings || []).forEach((building) => {
          buildingsMap[building._id] = building;
        });
        setBuildings(buildingsMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Filter meters by utility type
  const filteredMeters = selectedUtilityType
    ? meters.filter((m) => m.meterType === selectedUtilityType)
    : meters;

  async function handleFileUpload(file: File) {
    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/utility-payments/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload file');
      }

      const data = await response.json();
      setReceiptUrl(data.fileUrl);
      setReceiptFileName(data.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload receipt');
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      handleFileUpload(file);
    }
  }

  function removeReceipt() {
    setReceiptFile(null);
    setReceiptUrl(null);
    setReceiptFileName(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!selectedMeterId || !selectedUtilityType || !amount || !paymentDate) {
      setError('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    try {
      const paymentData = {
        meterId: selectedMeterId,
        utilityType: selectedUtilityType,
        periodStart,
        periodEnd,
        amount: parseFloat(amount),
        paymentDate,
        paymentMethod: paymentMethod || 'other',
        receiptUrl: receiptUrl || null,
        receiptFileName: receiptFileName || null,
        notes: notes || null,
      };

      const response = await apiPost<{ message: string; utilityPayment: { _id: string } }>(
        '/api/utility-payments',
        paymentData,
      );

      setSuccess('Utility payment created successfully!');
      setTimeout(() => {
        router.push(`/org/utilities/payments/${response.utilityPayment._id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create utility payment');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="New Utility Payment"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Utilities', href: '/org/meters' },
          { label: 'Payments', href: '/org/utilities/payments' },
          { label: 'New', href: '#' },
        ]}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading form...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="New Utility Payment"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Utilities', href: '/org/meters' },
        { label: 'Payments', href: '/org/utilities/payments' },
        { label: 'New', href: '#' },
      ]}
    >
      <div className="col-span-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/org/utilities/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">New Utility Payment</h2>
            <p className="text-sm text-muted-foreground">
              Record a utility payment with receipt attachment
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Receipt className="h-4 w-4" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="utilityType">
                    Utility Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedUtilityType}
                    onValueChange={(value) => {
                      setSelectedUtilityType(value as UtilityType);
                      setSelectedMeterId(''); // Reset meter selection when type changes
                    }}
                    required
                  >
                    <SelectTrigger id="utilityType">
                      <SelectValue placeholder="Select utility type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electricity">Electricity</SelectItem>
                      <SelectItem value="water">Water</SelectItem>
                      <SelectItem value="gas">Gas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meterId">
                    Meter <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedMeterId}
                    onValueChange={setSelectedMeterId}
                    required
                    disabled={!selectedUtilityType}
                  >
                    <SelectTrigger id="meterId">
                      <SelectValue placeholder="Select meter" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMeters.map((meter) => {
                        const building = buildings[meter.buildingId];
                        return (
                          <SelectItem key={meter._id} value={meter._id}>
                            {meter.meterNumber}
                            {building && ` - ${building.name}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodStart">
                    Period Start <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodEnd">
                    Period End <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Amount (ETB) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentDate">
                    Payment Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this payment..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receipt Attachment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {receiptUrl ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {receiptFileName?.toLowerCase().endsWith('.pdf') ? (
                        <FileText className="h-8 w-8 text-primary" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-primary" />
                      )}
                      <div>
                        <p className="font-medium">{receiptFileName}</p>
                        <p className="text-sm text-muted-foreground">Receipt uploaded</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={removeReceipt}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {receiptFileName && !receiptFileName.toLowerCase().endsWith('.pdf') && (
                    <div className="mt-4">
                      <img
                        src={receiptUrl}
                        alt="Receipt preview"
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="receipt">Upload Receipt (Image or PDF)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="receipt"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="cursor-pointer"
                    />
                    {isUploading && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span className="text-sm">Uploading...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Accepted formats: JPG, PNG, GIF, WebP, PDF. Max size: 10MB
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/org/utilities/payments')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardPage>
  );
}
