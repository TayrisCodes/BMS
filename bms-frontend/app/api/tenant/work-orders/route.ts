import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findComplaintsByTenant } from '@/lib/complaints/complaints';
import { findLeasesByTenant } from '@/lib/leases/leases';
import { listWorkOrders } from '@/lib/work-orders/work-orders';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const tenantId = tenant._id.toString();

    // Get tenant's complaints to find linked work orders
    const complaints = await findComplaintsByTenant(tenantId, organizationId);
    const complaintIds = complaints.map((c) => c._id.toString()).filter((id): id is string => !!id);

    // Get tenant's leases to find unit IDs
    const leases = await findLeasesByTenant(tenantId, organizationId);
    const unitIds = leases.map((l) => l.unitId).filter((id): id is string => !!id);

    // Find work orders linked to tenant's complaints or units
    const query: Record<string, unknown> = {
      organizationId,
    };

    // Build $or condition for complaint or unit matching
    const orConditions: Record<string, unknown>[] = [];
    if (complaintIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      orConditions.push({ complaintId: { $in: complaintIds.map((id) => new ObjectId(id)) } });
    }
    if (unitIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      orConditions.push({ unitId: { $in: unitIds.map((id) => new ObjectId(id)) } });
    }

    if (orConditions.length > 0) {
      query.$or = orConditions;
    } else {
      // If no complaints or units, return empty array
      return NextResponse.json({ workOrders: [], count: 0 });
    }

    const workOrders = await listWorkOrders(query);

    // Format work orders for response
    const formattedWorkOrders = workOrders.map((wo) => ({
      id: wo._id.toString(),
      title: wo.title,
      description: wo.description,
      category: wo.category,
      priority: wo.priority,
      status: wo.status,
      assignedTo: wo.assignedTo || null,
      estimatedCost: wo.estimatedCost || null,
      actualCost: wo.actualCost || null,
      completedAt: wo.completedAt ? wo.completedAt.toISOString() : null,
      notes: wo.notes || null,
      photos: wo.photos || [],
      complaintId: wo.complaintId || null,
      unitId: wo.unitId || null,
      createdAt: wo.createdAt.toISOString(),
      updatedAt: wo.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      workOrders: formattedWorkOrders,
      count: formattedWorkOrders.length,
    });
  } catch (error) {
    console.error('Tenant work orders error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied') || error.message.includes('does not belong')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 });
  }
}
