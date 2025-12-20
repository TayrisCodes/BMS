'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { apiGet, apiPatch, apiDelete, apiPost } from '@/lib/utils/api-client';
import {
  ArrowLeft,
  FileText,
  Edit,
  Trash2,
  Building2,
  Home,
  User,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  CreditCard,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface Lease {
  _id: string;
  tenantId: string;
  unitId: string;
  buildingId?: string | null;
  startDate: string;
  endDate?: string | null;
  rentAmount?: number;
  depositAmount?: number | null;
  billingCycle: string;
  dueDay?: number | null;
  additionalCharges?:
    | {
        name: string;
        amount: number;
      }[]
    | null;
  status: string;
  terminationDate?: string | null;
  terminationReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  terms?: {
    rent: number;
    serviceCharges?: number | null;
    deposit?: number | null;
    vatIncluded?: boolean;
    vatRate?: number | null;
    currency?: string;
  };
  penaltyConfig?: {
    lateFeeRatePerDay?: number | null;
    lateFeeGraceDays?: number | null;
    lateFeeCapDays?: number | null;
  } | null;
  paymentDueDays?: number | null;
  renewalNoticeDays?: number | null;
  nextInvoiceDate?: string | null;
  lastInvoicedAt?: string | null;
  documents?:
    | {
        _id?: string;
        filename: string;
        size: number;
        contentType: string;
        gridFsId: string;
        uploadedBy: string;
        uploadedAt: string;
      }[]
    | null;
  termsTemplateId?: string | null;
  customTermsText?: string | null;
  termsAccepted?: { userId: string; role?: string | null; acceptedAt: string }[] | null;
  parkingAssignmentId?: string | null;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email?: string | null;
}

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId: string;
  unitType: string;
  status: string;
}

interface Building {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
}

interface ParkingAssignment {
  _id: string;
  parkingSpaceId: string;
  status: string;
  billingPeriod: string;
  rate: number;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  status: string;
}

export default function LeaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leaseId = params.id as string;
  const [lease, setLease] = useState<Lease | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [parkingAssignment, setParkingAssignment] = useState<ParkingAssignment | null>(null);
  const [parkingSpace, setParkingSpace] = useState<ParkingSpace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  // Set default period to current month
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    setPeriodStart(start.toISOString().split('T')[0] || '');
    setPeriodEnd(end.toISOString().split('T')[0] || '');
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const leaseData = await apiGet<{ lease: Lease }>(`/api/leases/${leaseId}`);
        setLease(leaseData.lease);

        // Fetch tenant
        try {
          const tenantData = await apiGet<{ tenant: Tenant }>(
            `/api/tenants/${leaseData.lease.tenantId}`,
          );
          setTenant(tenantData.tenant);
        } catch {
          // Tenant not found
        }

        // Fetch unit
        try {
          const unitData = await apiGet<{ unit: Unit }>(`/api/units/${leaseData.lease.unitId}`);
          setUnit(unitData.unit);

          // Fetch building
          try {
            const buildingData = await apiGet<{ building: Building }>(
              `/api/buildings/${unitData.unit.buildingId}`,
            );
            setBuilding(buildingData.building);
          } catch {
            // Building not found
          }
        } catch {
          // Unit not found
        }

        // Fetch parking assignment if present
        if (leaseData.lease.parkingAssignmentId) {
          try {
            const assignmentRes = await apiGet<{ parkingAssignment: ParkingAssignment }>(
              `/api/parking/assignments/${leaseData.lease.parkingAssignmentId}`,
            );
            setParkingAssignment(assignmentRes.parkingAssignment);

            if (assignmentRes.parkingAssignment?.parkingSpaceId) {
              const spaceRes = await apiGet<{ parkingSpace: ParkingSpace }>(
                `/api/parking-spaces/${assignmentRes.parkingAssignment.parkingSpaceId}`,
              );
              setParkingSpace(spaceRes.parkingSpace);
            }
          } catch (err) {
            console.error('Failed to fetch parking assignment for lease', err);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lease');
      } finally {
        setIsLoading(false);
      }
    }

    if (leaseId) {
      fetchData();
    }
  }, [leaseId]);

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const updates = {
      startDate: formData.get('startDate')?.toString() || lease?.startDate,
      endDate: formData.get('endDate')?.toString() || null,
      // dueDay optional; if empty, use null to allow paymentDueDays-based due
      dueDay: (() => {
        const raw = formData.get('dueDay')?.toString();
        if (!raw) return null;
        const parsed = parseInt(raw, 10);
        return Number.isNaN(parsed) ? null : parsed;
      })(),
      terms: {
        rent: formData.get('rentAmount')
          ? parseFloat(formData.get('rentAmount')!.toString())
          : (lease?.terms?.rent ?? lease?.rentAmount ?? 0),
        serviceCharges: formData.get('serviceCharges')
          ? parseFloat(formData.get('serviceCharges')!.toString())
          : (lease?.terms?.serviceCharges ?? null),
        deposit: formData.get('depositAmount')
          ? parseFloat(formData.get('depositAmount')!.toString())
          : (lease?.terms?.deposit ?? lease?.depositAmount ?? null),
        vatIncluded: formData.get('vatIncluded') === 'on',
        vatRate: formData.get('vatRate')
          ? parseFloat(formData.get('vatRate')!.toString())
          : (lease?.terms?.vatRate ?? 15),
        currency: 'ETB',
      },
      billingCycle: formData.get('billingCycle')?.toString() || lease?.billingCycle,
      penaltyConfig: {
        lateFeeRatePerDay: formData.get('lateFeeRatePerDay')
          ? parseFloat(formData.get('lateFeeRatePerDay')!.toString())
          : (lease?.penaltyConfig?.lateFeeRatePerDay ?? 0.0005),
        lateFeeGraceDays: formData.get('lateFeeGraceDays')
          ? parseInt(formData.get('lateFeeGraceDays')!.toString(), 10)
          : (lease?.penaltyConfig?.lateFeeGraceDays ?? 0),
        lateFeeCapDays: formData.get('lateFeeCapDays')
          ? parseInt(formData.get('lateFeeCapDays')!.toString(), 10)
          : (lease?.penaltyConfig?.lateFeeCapDays ?? null),
      },
      paymentDueDays: formData.get('paymentDueDays')
        ? parseInt(formData.get('paymentDueDays')!.toString(), 10)
        : (lease?.paymentDueDays ?? null),
      renewalNoticeDays: formData.get('renewalNoticeDays')
        ? parseInt(formData.get('renewalNoticeDays')!.toString(), 10)
        : (lease?.renewalNoticeDays ?? null),
      customTermsText:
        formData.get('customTermsText')?.toString() || lease?.customTermsText || null,
    };

    try {
      const result = await apiPatch<{ lease: Lease }>(`/api/leases/${leaseId}`, updates);
      setLease(result.lease);
      setIsEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update lease');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTerminate() {
    if (!terminateReason.trim()) {
      setEditError('Please provide a termination reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiDelete(`/api/leases/${leaseId}`, { reason: terminateReason });
      router.push('/admin/leases');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to terminate lease');
      setIsSubmitting(false);
    }
  }

  function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'active':
        return 'default';
      case 'expired':
        return 'secondary';
      case 'terminated':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  async function handleGenerateInvoice() {
    if (!lease) return;

    setGenerateError(null);
    setGenerateSuccess(null);
    setIsGenerating(true);

    try {
      const payload: {
        leaseId: string;
        periodStart?: string;
        periodEnd?: string;
      } = {
        leaseId: lease._id,
      };

      // Period is optional for single lease generation
      if (periodStart && periodEnd) {
        payload.periodStart = new Date(periodStart).toISOString();
        payload.periodEnd = new Date(periodEnd + 'T23:59:59.999Z').toISOString();
      }

      const result = await apiPost<{ invoice: { _id: string; invoiceNumber: string } }>(
        '/api/invoices',
        payload,
      );
      setGenerateSuccess(
        `Invoice generated successfully: ${result.invoice.invoiceNumber}. Redirecting to invoice...`,
      );

      // Redirect to invoice detail page after a short delay
      setTimeout(() => {
        router.push(`/org/invoices/${result.invoice._id}`);
      }, 1500);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading lease details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !lease) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive mb-4">{error || 'Lease not found'}</p>
            <Link href="/admin/leases">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Leases
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = lease.status === 'active';
  const isTerminated = lease.status === 'terminated';
  const effectiveRent = lease.rentAmount ?? lease.terms?.rent ?? 0;
  const effectiveDeposit = lease.depositAmount ?? lease.terms?.deposit ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/admin/leases">
            <Button variant="ghost" size="sm" className="mt-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-bold">Lease Agreement</h1>
                <Badge variant={getStatusVariant(lease.status)} className="text-sm px-3 py-1">
                  {lease.status}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                {tenant && (
                  <>
                    <User className="h-4 w-4" />
                    {tenant.firstName} {tenant.lastName}
                  </>
                )}
                {unit && (
                  <>
                    <span className="mx-2">•</span>
                    <Home className="h-4 w-4" />
                    {unit.unitNumber}
                  </>
                )}
                {building && (
                  <>
                    <span className="mx-2">•</span>
                    <Building2 className="h-4 w-4" />
                    {building.name}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && (
            <>
              <Button onClick={() => setIsGenerateInvoiceOpen(true)} variant="default">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Invoice
              </Button>
              <Button onClick={() => setIsEditOpen(true)} variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Lease
              </Button>
              <Button onClick={() => setIsTerminateOpen(true)} variant="destructive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Terminate
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lease Information Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lease Information
            </CardTitle>
            <CardDescription>Detailed information about this lease agreement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </div>
                <p className="text-lg font-semibold">
                  {new Date(lease.startDate).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  End Date
                </div>
                <p className="text-lg font-semibold">
                  {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Open-ended'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Rent Amount
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(effectiveRent)} / {lease.billingCycle}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Deposit Amount
                </div>
                <p className="text-lg font-semibold">{formatCurrency(effectiveDeposit)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Billing Cycle
                </div>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {lease.billingCycle}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Billing / Due
                </div>
                <p className="text-lg font-semibold">
                  {lease.billingCycle}{' '}
                  {lease.dueDay
                    ? `• Due Day ${lease.dueDay}`
                    : `• Due ${lease.paymentDueDays ?? 7} days after invoice`}
                </p>
              </div>

              {lease.terminationDate && (
                <>
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      Termination Date
                    </div>
                    <p className="text-lg font-semibold text-destructive">
                      {new Date(lease.terminationDate).toLocaleDateString()}
                    </p>
                  </div>
                  {lease.terminationReason && (
                    <div className="space-y-1 md:col-span-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        Termination Reason
                      </div>
                      <p className="text-base">{lease.terminationReason}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {(lease.terms?.serviceCharges ||
              (lease.additionalCharges && lease.additionalCharges.length > 0)) && (
              <div className="mt-6 pt-6 border-t space-y-3">
                <h3 className="font-semibold">Charges</h3>
                {lease.terms?.serviceCharges ? (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Service Charges</span>
                    <span className="font-semibold">
                      {formatCurrency(lease.terms.serviceCharges)}
                    </span>
                  </div>
                ) : null}
                {lease.additionalCharges && lease.additionalCharges.length > 0 && (
                  <div className="space-y-2">
                    {lease.additionalCharges.map((charge, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{charge.name}</span>
                        <span className="font-semibold">{formatCurrency(charge.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(lease.paymentDueDays ||
              lease.penaltyConfig ||
              lease.nextInvoiceDate ||
              lease.renewalNoticeDays) && (
              <div className="mt-6 pt-6 border-t space-y-3">
                <h3 className="font-semibold">Payments & Penalties</h3>
                {lease.paymentDueDays && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Due</span>
                    <span className="font-semibold">{lease.paymentDueDays} days after invoice</span>
                  </div>
                )}
                {lease.penaltyConfig?.lateFeeRatePerDay && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Late Fee</span>
                    <span className="font-semibold">
                      {(lease.penaltyConfig.lateFeeRatePerDay * 100).toFixed(2)}% per day
                      {lease.penaltyConfig.lateFeeGraceDays
                        ? ` after ${lease.penaltyConfig.lateFeeGraceDays} days`
                        : ''}
                      {lease.penaltyConfig.lateFeeCapDays
                        ? ` (cap ${lease.penaltyConfig.lateFeeCapDays} days)`
                        : ''}
                    </span>
                  </div>
                )}
                {lease.renewalNoticeDays && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Renewal Notice</span>
                    <span className="font-semibold">{lease.renewalNoticeDays} days before end</span>
                  </div>
                )}
                {lease.nextInvoiceDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Invoice</span>
                    <span className="font-semibold">
                      {new Date(lease.nextInvoiceDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {lease.lastInvoicedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Invoiced</span>
                    <span className="font-semibold">
                      {new Date(lease.lastInvoicedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {lease.customTermsText && (
              <div className="mt-6 pt-6 border-t space-y-2">
                <h3 className="font-semibold">Custom Terms</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {lease.customTermsText}
                </p>
              </div>
            )}

            {lease.documents && lease.documents.length > 0 && (
              <div className="mt-6 pt-6 border-t space-y-3">
                <h3 className="font-semibold">Documents</h3>
                <div className="space-y-2">
                  {lease.documents.map((doc) => (
                    <div
                      key={doc._id || doc.gridFsId}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm">{doc.filename}</span>
                      <Link
                        className="text-primary text-sm underline"
                        href={`/api/leases/${lease._id}/documents/${doc.gridFsId}`}
                        target="_blank"
                      >
                        Download
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant, Unit & Parking Cards */}
        <div className="space-y-6">
          {/* Tenant Card */}
          {tenant ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Tenant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={`/admin/tenants/${tenant._id}`}>
                  <p className="text-xl font-semibold hover:text-primary cursor-pointer transition-colors">
                    {tenant.firstName} {tenant.lastName}
                  </p>
                </Link>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {tenant.primaryPhone}
                </div>
                {tenant.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {tenant.email}
                  </div>
                )}
                <Link href={`/admin/tenants/${tenant._id}`}>
                  <Button variant="outline" className="w-full mt-4">
                    View Tenant Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Tenant not found</p>
              </CardContent>
            </Card>
          )}

          {/* Unit Card */}
          {unit ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Unit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={`/admin/units/${unit._id}`}>
                  <p className="text-xl font-semibold hover:text-primary cursor-pointer transition-colors">
                    {unit.unitNumber}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{unit.unitType}</Badge>
                  <Badge variant={unit.status === 'occupied' ? 'default' : 'secondary'}>
                    {unit.status}
                  </Badge>
                </div>
                {building && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {building.name}
                  </div>
                )}
                <Link href={`/admin/units/${unit._id}`}>
                  <Button variant="outline" className="w-full mt-4">
                    View Unit Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Home className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Unit not found</p>
              </CardContent>
            </Card>
          )}

          {/* Parking Card */}
          {parkingAssignment ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Parking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Space</span>
                  <span className="font-semibold">
                    {parkingSpace ? parkingSpace.spaceNumber : parkingAssignment.parkingSpaceId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      parkingAssignment.status === 'active'
                        ? 'default'
                        : parkingAssignment.status === 'completed'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="capitalize"
                  >
                    {parkingAssignment.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-semibold capitalize">
                    {parkingAssignment.billingPeriod} • ETB{' '}
                    {parkingAssignment.rate.toLocaleString()}
                  </span>
                </div>
                <Link href={`/org/parking/assignments/${parkingAssignment._id}`}>
                  <Button variant="outline" className="w-full mt-3">
                    View Parking Assignment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-sm">
                <Home className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-center">
                  No parking assignment linked to this lease.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lease</DialogTitle>
            <DialogDescription>Update the lease information below</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            {editError && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">
                {editError}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-startDate">Start Date *</Label>
                  <Input
                    id="edit-startDate"
                    name="startDate"
                    type="date"
                    defaultValue={
                      lease.startDate ? new Date(lease.startDate).toISOString().split('T')[0] : ''
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-endDate">End Date (Optional)</Label>
                  <Input
                    id="edit-endDate"
                    name="endDate"
                    type="date"
                    defaultValue={
                      lease.endDate ? new Date(lease.endDate).toISOString().split('T')[0] : ''
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for open-ended lease
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-rentAmount">Rent Amount (ETB) *</Label>
                  <Input
                    id="edit-rentAmount"
                    name="rentAmount"
                    type="number"
                    step="0.01"
                    defaultValue={effectiveRent}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-depositAmount">Deposit Amount (ETB)</Label>
                  <Input
                    id="edit-depositAmount"
                    name="depositAmount"
                    type="number"
                    step="0.01"
                    defaultValue={effectiveDeposit || ''}
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-serviceCharges">Service Charges (ETB)</Label>
                  <Input
                    id="edit-serviceCharges"
                    name="serviceCharges"
                    type="number"
                    step="0.01"
                    defaultValue={lease.terms?.serviceCharges ?? ''}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-vatRate">VAT Rate (%)</Label>
                  <Input
                    id="edit-vatRate"
                    name="vatRate"
                    type="number"
                    step="0.01"
                    defaultValue={lease.terms?.vatRate ?? 15}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id="edit-vatIncluded"
                      name="vatIncluded"
                      type="checkbox"
                      defaultChecked={lease.terms?.vatIncluded ?? false}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="edit-vatIncluded">VAT Included in rent</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-billingCycle">Billing Cycle *</Label>
                  <Select name="billingCycle" defaultValue={lease.billingCycle} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-dueDay">Due Day (1-31)</Label>
                  <Input
                    id="edit-dueDay"
                    name="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={lease.dueDay ?? ''}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use payment due days instead
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-lateFeeRatePerDay">Late Fee Rate (per day)</Label>
                  <Input
                    id="edit-lateFeeRatePerDay"
                    name="lateFeeRatePerDay"
                    type="number"
                    step="0.0001"
                    defaultValue={lease.penaltyConfig?.lateFeeRatePerDay ?? 0.0005}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-lateFeeGraceDays">Grace Days</Label>
                  <Input
                    id="edit-lateFeeGraceDays"
                    name="lateFeeGraceDays"
                    type="number"
                    min="0"
                    defaultValue={lease.penaltyConfig?.lateFeeGraceDays ?? 0}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-lateFeeCapDays">Cap Days</Label>
                  <Input
                    id="edit-lateFeeCapDays"
                    name="lateFeeCapDays"
                    type="number"
                    min="0"
                    defaultValue={lease.penaltyConfig?.lateFeeCapDays ?? ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-paymentDueDays">Payment Due Days</Label>
                  <Input
                    id="edit-paymentDueDays"
                    name="paymentDueDays"
                    type="number"
                    min="1"
                    defaultValue={lease.paymentDueDays ?? ''}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-renewalNoticeDays">Renewal Notice Days</Label>
                  <Input
                    id="edit-renewalNoticeDays"
                    name="renewalNoticeDays"
                    type="number"
                    min="0"
                    defaultValue={lease.renewalNoticeDays ?? ''}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-customTermsText">Custom Terms</Label>
                <Textarea
                  id="edit-customTermsText"
                  name="customTermsText"
                  defaultValue={lease.customTermsText ?? ''}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Terminate Dialog */}
      <Dialog open={isTerminateOpen} onOpenChange={setIsTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Lease</DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate this lease? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editError && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{editError}</div>
            )}
            <div>
              <Label htmlFor="terminateReason">Termination Reason *</Label>
              <Textarea
                id="terminateReason"
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                placeholder="Enter the reason for terminating this lease..."
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setIsTerminateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleTerminate}
              disabled={isSubmitting || !terminateReason.trim()}
            >
              {isSubmitting ? 'Terminating...' : 'Terminate Lease'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={isGenerateInvoiceOpen} onOpenChange={setIsGenerateInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>
              Generate an invoice for this lease. Leave period empty to use the current billing
              period.
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoicePeriodStart">Period Start (Optional)</Label>
                <Input
                  id="invoicePeriodStart"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for current period</p>
              </div>
              <div>
                <Label htmlFor="invoicePeriodEnd">Period End (Optional)</Label>
                <Input
                  id="invoicePeriodEnd"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for current period</p>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                The invoice will be generated based on the lease&apos;s rent amount and billing
                cycle. If a period is not specified, the system will use the current billing period.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsGenerateInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateInvoice} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
