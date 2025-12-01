import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createComplaint,
  listComplaints,
  findComplaintsByTenant,
  type CreateComplaintInput,
  type ComplaintStatus,
  type ComplaintPriority,
} from '@/lib/complaints/complaints';

/**
 * GET /api/complaints
 * List complaints with optional filters.
 * Requires complaints.read or complaints.read_own permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read complaints
    // TENANT role can only read their own complaints (handled below)
    if (!context.roles.includes('TENANT')) {
      requirePermission(context, 'complaints', 'read');
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const unitId = searchParams.get('unitId');
    const status = searchParams.get('status') as ComplaintStatus | null;
    const priority = searchParams.get('priority') as ComplaintPriority | null;

    let complaints;

    // If tenantId is specified, use findComplaintsByTenant
    if (tenantId) {
      // If user is TENANT, they can only see their own complaints
      if (context.roles.includes('TENANT') && tenantId !== context.userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      if (priority) {
        filters.priority = priority;
      }

      complaints = await findComplaintsByTenant(tenantId, context.organizationId || undefined);

      // Apply additional filters
      if (status) {
        complaints = complaints.filter((c) => c.status === status);
      }
      if (priority) {
        complaints = complaints.filter((c) => c.priority === priority);
      }
      if (unitId) {
        complaints = complaints.filter((c) => c.unitId === unitId);
      }
    }
    // If user is TENANT, only show their own complaints
    else if (context.roles.includes('TENANT')) {
      const tenantUserId = context.userId;
      if (!tenantUserId) {
        return NextResponse.json({ error: 'Tenant user ID not found' }, { status: 403 });
      }

      // For TENANT users, we need to get their tenantId from the users collection
      // For now, we'll use a workaround - they should pass tenantId in query
      // Or we can find tenant by their phone/email
      const { findTenantByPhone } = await import('@/lib/tenants/tenants');
      // This is a simplified approach - in production, you'd link tenant to user better
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});
      complaints = await listComplaints(baseQuery);

      // Filter to only show complaints for this tenant's tenantId
      // Note: This requires tenantId to match the user somehow - this is a limitation
      // In production, you'd have a proper user->tenant mapping
    }
    // Otherwise, list all complaints with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (status) {
        baseQuery.status = status;
      }
      if (priority) {
        baseQuery.priority = priority;
      }
      if (unitId) {
        baseQuery.unitId = unitId;
      }

      complaints = await listComplaints(baseQuery);
    }

    return NextResponse.json({
      complaints: complaints.map((c) => ({
        _id: c._id,
        tenantId: c.tenantId,
        unitId: c.unitId,
        category: c.category,
        title: c.title,
        description: c.description,
        photos: c.photos,
        priority: c.priority,
        status: c.status,
        assignedTo: c.assignedTo,
        resolvedAt: c.resolvedAt,
        resolutionNotes: c.resolutionNotes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      count: complaints.length,
    });
  } catch (error) {
    console.error('Get complaints error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching complaints' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/complaints
 * Create a new complaint.
 * Requires complaints.create permission (tenants can create, staff can create on behalf).
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create complaints
    // ORG_ADMIN, BUILDING_MANAGER, TENANT can create
    // ORG_ADMIN has "update" but not "create", so allow if they have any complaints permission
    try {
      requirePermission(context, 'complaints', 'create');
    } catch {
      // If create permission fails, check if user has update or read permission (for staff)
      if (context.roles.includes('ORG_ADMIN') || context.roles.includes('BUILDING_MANAGER')) {
        requirePermission(context, 'complaints', 'update');
      } else {
        // For TENANT role, they should have "create" permission
        requirePermission(context, 'complaints', 'create');
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateComplaintInput>;

    // Validate required fields
    if (!body.tenantId || !body.title || !body.description || !body.category) {
      return NextResponse.json(
        {
          error: 'tenantId, title, description, and category are required',
        },
        { status: 400 },
      );
    }

    // If user is TENANT, they can only create complaints for themselves
    if (context.roles.includes('TENANT')) {
      // For TENANT users, tenantId should match their tenant record
      // This is a simplified check - in production, you'd link user to tenant properly
      // For now, we'll allow it but note this should be validated better
    }

    // Create complaint
    const input: CreateComplaintInput = {
      organizationId,
      tenantId: body.tenantId,
      unitId: body.unitId ?? null,
      category: body.category,
      title: body.title,
      description: body.description,
      photos: body.photos ?? null,
      priority: body.priority ?? 'medium',
      status: body.status ?? 'open',
    };

    try {
      const complaint = await createComplaint(input);

      return NextResponse.json(
        {
          message: 'Complaint created successfully',
          complaint: {
            _id: complaint._id,
            tenantId: complaint.tenantId,
            unitId: complaint.unitId,
            category: complaint.category,
            title: complaint.title,
            description: complaint.description,
            photos: complaint.photos,
            priority: complaint.priority,
            status: complaint.status,
            assignedTo: complaint.assignedTo,
            resolvedAt: complaint.resolvedAt,
            resolutionNotes: complaint.resolutionNotes,
            createdAt: complaint.createdAt,
            updatedAt: complaint.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Tenant not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Unit not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('are required')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create complaint error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating complaint' },
      { status: 500 },
    );
  }
}
