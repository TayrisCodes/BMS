import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone } from '@/lib/tenants/tenants';
import { findComplaintById } from '@/lib/complaints/complaints';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const { id: complaintId } = await routeParams.params;

    // Get complaint
    const complaint = await findComplaintById(complaintId, organizationId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Verify complaint belongs to this tenant
    if (complaint.tenantId !== tenant._id.toString()) {
      return NextResponse.json(
        { error: 'Access denied: Complaint does not belong to you' },
        { status: 403 },
      );
    }

    // Format complaint response
    const formattedComplaint = {
      id: complaint._id.toString(),
      title: complaint.title,
      category: complaint.category,
      description: complaint.description,
      status: complaint.status,
      priority: complaint.priority,
      photos: complaint.photos || [],
      assignedTo: complaint.assignedTo,
      resolvedAt: complaint.resolvedAt ? complaint.resolvedAt.toISOString() : null,
      resolutionNotes: complaint.resolutionNotes,
      // Maintenance request fields
      type: complaint.type || 'complaint',
      maintenanceCategory: complaint.maintenanceCategory || null,
      urgency: complaint.urgency || null,
      preferredTimeWindow: complaint.preferredTimeWindow
        ? {
            start:
              complaint.preferredTimeWindow.start instanceof Date
                ? complaint.preferredTimeWindow.start.toISOString()
                : new Date(complaint.preferredTimeWindow.start).toISOString(),
            end:
              complaint.preferredTimeWindow.end instanceof Date
                ? complaint.preferredTimeWindow.end.toISOString()
                : new Date(complaint.preferredTimeWindow.end).toISOString(),
          }
        : null,
      linkedWorkOrderId: complaint.linkedWorkOrderId || null,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: complaint.updatedAt.toISOString(),
    };

    return NextResponse.json({ complaint: formattedComplaint });
  } catch (error) {
    console.error('Tenant complaint detail error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied') || error.message.includes('does not belong')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch complaint' }, { status: 500 });
  }
}
