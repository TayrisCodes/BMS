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
  Car,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  Building2,
  UserCheck,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

interface ParkingAssignment {
  _id: string;
  parkingSpaceId: string;
  buildingId: string;
  assignmentType: 'tenant' | 'visitor';
  tenantId: string | null;
  visitorLogId: string | null;
  vehicleId: string | null;
  startDate: string;
  endDate: string | null;
  billingPeriod: 'monthly' | 'daily' | 'hourly';
  rate: number;
  invoiceId: string | null;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface ParkingSpace {
  _id: string;
  spaceNumber: string;
  spaceType: string;
}

interface Building {
  _id: string;
  name: string;
}

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
}

interface VisitorLog {
  _id: string;
  visitorName: string;
  visitorPhone?: string;
  entryTime: string;
}

interface Vehicle {
  _id: string;
  plateNumber: string;
  make?: string;
  model?: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
}

export default function ParkingAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<ParkingAssignment | null>(null);
  const [parkingSpace, setParkingSpace] = useState<ParkingSpace | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [visitorLog, setVisitorLog] = useState<VisitorLog | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchAssignmentData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch assignment
        const assignmentData = await apiGet<{ parkingAssignment: ParkingAssignment }>(
          `/api/parking/assignments/${assignmentId}`,
        );
        setAssignment(assignmentData.parkingAssignment);

        // Fetch related data
        const [spaceData, buildingData] = await Promise.all([
          apiGet<{ parkingSpace: ParkingSpace }>(
            `/api/parking-spaces/${assignmentData.parkingAssignment.parkingSpaceId}`,
          ).catch(() => null),
          apiGet<{ building: Building }>(
            `/api/buildings/${assignmentData.parkingAssignment.buildingId}`,
          ).catch(() => null),
        ]);

        if (spaceData) setParkingSpace(spaceData.parkingSpace);
        if (buildingData) setBuilding(buildingData.building);

        // Fetch tenant or visitor log
        if (
          assignmentData.parkingAssignment.assignmentType === 'tenant' &&
          assignmentData.parkingAssignment.tenantId
        ) {
          try {
            const tenantData = await apiGet<{ tenant: Tenant }>(
              `/api/tenants/${assignmentData.parkingAssignment.tenantId}`,
            );
            setTenant(tenantData.tenant);
          } catch (err) {
            console.warn('Failed to fetch tenant:', err);
          }
        } else if (
          assignmentData.parkingAssignment.assignmentType === 'visitor' &&
          assignmentData.parkingAssignment.visitorLogId
        ) {
          try {
            const visitorData = await apiGet<{ visitorLog: VisitorLog }>(
              `/api/visitor-logs/${assignmentData.parkingAssignment.visitorLogId}`,
            );
            setVisitorLog(visitorData.visitorLog);
          } catch (err) {
            console.warn('Failed to fetch visitor log:', err);
          }
        }

        // Fetch vehicle if available
        if (assignmentData.parkingAssignment.vehicleId) {
          try {
            const vehicleData = await apiGet<{ vehicle: Vehicle }>(
              `/api/vehicles/${assignmentData.parkingAssignment.vehicleId}`,
            );
            setVehicle(vehicleData.vehicle);
          } catch (err) {
            console.warn('Failed to fetch vehicle:', err);
          }
        }

        // Fetch invoice if available
        if (assignmentData.parkingAssignment.invoiceId) {
          try {
            const invoiceData = await apiGet<{ invoice: Invoice }>(
              `/api/invoices/${assignmentData.parkingAssignment.invoiceId}`,
            );
            setInvoice(invoiceData.invoice);
          } catch (err) {
            console.warn('Failed to fetch invoice:', err);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assignment');
      } finally {
        setIsLoading(false);
      }
    }

    if (assignmentId) {
      fetchAssignmentData();
    }
  }, [assignmentId]);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiDelete(`/api/parking/assignments/${assignmentId}`);
      router.push(
        assignment?.assignmentType === 'tenant' ? '/org/parking/tenants' : '/org/parking/visitors',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (isLoading) {
    return (
      <DashboardPage
        title="Parking Assignment Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Assignment Details', href: '#' },
        ]}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading assignment...</p>
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (error || !assignment) {
    return (
      <DashboardPage
        title="Parking Assignment Details"
        breadcrumbs={[
          { label: 'Organization', href: '/org' },
          { label: 'Parking', href: '/org/parking/spaces' },
          { label: 'Assignment Details', href: '#' },
        ]}
      >
        <div className="col-span-full">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Assignment Not Found</h3>
                <p className="text-muted-foreground mb-4">
                  {error || 'The assignment you are looking for does not exist.'}
                </p>
                <Button onClick={() => router.push('/org/parking/spaces')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Parking
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Parking Assignment Details"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Parking', href: '/org/parking/spaces' },
        {
          label: assignment.assignmentType === 'tenant' ? 'Tenant Parking' : 'Visitor Parking',
          href:
            assignment.assignmentType === 'tenant'
              ? '/org/parking/tenants'
              : '/org/parking/visitors',
        },
        { label: 'Details', href: '#' },
      ]}
    >
      <div className="col-span-full space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                assignment.assignmentType === 'tenant'
                  ? '/org/parking/tenants'
                  : '/org/parking/visitors',
              )
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            {assignment.status === 'active' && assignment.assignmentType === 'visitor' && (
              <Link href={`/org/parking/visitors/${assignmentId}/end`}>
                <Button variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  End Assignment
                </Button>
              </Link>
            )}
            {assignment.status === 'active' && (
              <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Assignment
              </Button>
            )}
          </div>
        </div>

        {/* Assignment Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                  {assignment.assignmentType === 'tenant' ? (
                    <Car className="h-6 w-6 text-primary" />
                  ) : (
                    <UserCheck className="h-6 w-6 text-primary" />
                  )}
                  {assignment.assignmentType === 'tenant' ? 'Tenant' : 'Visitor'} Parking Assignment
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  {assignment.status === 'active' ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : assignment.status === 'completed' ? (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Completed
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Cancelled
                    </Badge>
                  )}
                  <Badge variant="outline">{assignment.billingPeriod}</Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="text-3xl font-bold">{formatCurrency(assignment.rate)}</p>
                <p className="text-xs text-muted-foreground">/{assignment.billingPeriod}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {assignment.assignmentType === 'tenant' ? 'Tenant' : 'Visitor'}
                  </p>
                  {assignment.assignmentType === 'tenant' && tenant ? (
                    <div>
                      <p className="font-medium">
                        {tenant.firstName} {tenant.lastName}
                      </p>
                      {tenant.primaryPhone && (
                        <p className="text-sm text-muted-foreground">{tenant.primaryPhone}</p>
                      )}
                    </div>
                  ) : assignment.assignmentType === 'visitor' && visitorLog ? (
                    <div>
                      <p className="font-medium">{visitorLog.visitorName}</p>
                      {visitorLog.visitorPhone && (
                        <p className="text-sm text-muted-foreground">{visitorLog.visitorPhone}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Unknown</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Parking Space</p>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{parkingSpace?.spaceNumber || 'Unknown'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Building</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{building?.name || 'Unknown'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Start Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{formatDate(assignment.startDate)}</p>
                  </div>
                </div>
                {assignment.endDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">End Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{formatDate(assignment.endDate)}</p>
                    </div>
                  </div>
                )}
                {vehicle && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Vehicle</p>
                    <div>
                      <p className="font-medium">{vehicle.plateNumber}</p>
                      {vehicle.make && vehicle.model && (
                        <p className="text-sm text-muted-foreground">
                          {vehicle.make} {vehicle.model}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {invoice && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Invoice</p>
                    <Link href={`/org/invoices/${invoice._id}`}>
                      <div className="flex items-center gap-2 text-primary hover:underline">
                        <Receipt className="h-4 w-4" />
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <Badge variant="outline">{formatCurrency(invoice.total)}</Badge>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Assignment ID</p>
                <p className="font-mono">{assignment._id}</p>
              </div>
              {assignment.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{formatDate(assignment.updatedAt)}</p>
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
            <DialogTitle>Cancel Parking Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this parking assignment? This action cannot be undone.
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
                  Cancelling...
                </>
              ) : (
                'Cancel Assignment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
