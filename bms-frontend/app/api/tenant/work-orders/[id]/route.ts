import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findComplaintsByTenant } from '@/lib/complaints/complaints';
import { findLeasesByTenant } from '@/lib/leases/leases';
import { findWorkOrderById } from '@/lib/work-orders/work-orders';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    const { id: workOrderId } = await routeParams.params;

    // Get work order
    const workOrder = await findWorkOrderById(workOrderId, organizationId);
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const tenantId = tenant._id.toString();

    // Verify work order is linked to tenant's complaint or unit
    let hasAccess = false;

    if (workOrder.complaintId) {
      const complaints = await findComplaintsByTenant(tenantId, organizationId);
      hasAccess = complaints.some((c) => c._id.toString() === workOrder.complaintId);
    }

    if (!hasAccess && workOrder.unitId) {
      const leases = await findLeasesByTenant(tenantId, organizationId);
      hasAccess = leases.some((l) => l.unitId === workOrder.unitId);
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied: Work order does not belong to you' },
        { status: 403 },
      );
    }

    // Format work order for response
    const formattedWorkOrder = {
      id: workOrder._id.toString(),
      title: workOrder.title,
      description: workOrder.description,
      category: workOrder.category,
      priority: workOrder.priority,
      status: workOrder.status,
      assignedTo: workOrder.assignedTo || null,
      estimatedCost: workOrder.estimatedCost || null,
      actualCost: workOrder.actualCost || null,
      completedAt: workOrder.completedAt ? workOrder.completedAt.toISOString() : null,
      notes: workOrder.notes || null,
      photos: workOrder.photos || [],
      complaintId: workOrder.complaintId || null,
      unitId: workOrder.unitId || null,
      createdAt: workOrder.createdAt.toISOString(),
      updatedAt: workOrder.updatedAt.toISOString(),
    };

    return NextResponse.json({ workOrder: formattedWorkOrder });
  } catch (error) {
    console.error('Tenant work order detail error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied') || error.message.includes('does not belong')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 });
  }
}

