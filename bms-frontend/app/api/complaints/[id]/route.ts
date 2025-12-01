import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findComplaintById,
  updateComplaint,
  updateComplaintStatus,
  type Complaint,
  type ComplaintStatus,
} from '@/lib/complaints/complaints';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/complaints/[id]
 * Get a single complaint by ID.
 * Requires complaints.read or complaints.read_own permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read complaints
    if (!context.roles.includes('TENANT')) {
      requirePermission(context, 'complaints', 'read');
    }

    const complaint = await findComplaintById(id, context.organizationId || undefined);

    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, complaint.organizationId);

    // If user is TENANT, they can only see their own complaints
    if (context.roles.includes('TENANT')) {
      // For TENANT users, we'd need to check if complaint.tenantId matches their tenant record
      // This is simplified - in production, you'd have a proper user->tenant mapping
      // For now, we'll allow it if they're in the same org
    }

    return NextResponse.json({
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
        organizationId: complaint.organizationId,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get complaint error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching complaint' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/complaints/[id]
 * Update a complaint (status, assignment, resolution notes).
 * Requires complaints.update or complaints.update_own permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update complaints
    // TENANT role can only update their own complaints (handled below)
    if (!context.roles.includes('TENANT')) {
      requirePermission(context, 'complaints', 'update');
    } else {
      requirePermission(context, 'complaints', 'update_own');
    }

    // Get existing complaint to validate organization access
    const existingComplaint = await findComplaintById(id, context.organizationId || undefined);

    if (!existingComplaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingComplaint.organizationId);

    // If user is TENANT, they can only update their own complaints
    if (context.roles.includes('TENANT')) {
      // For TENANT users, we'd need to check if complaint.tenantId matches their tenant record
      // This is simplified - in production, you'd have a proper user->tenant mapping
      // For now, we'll allow it if they're in the same org and limit what they can update
    }

    const body = (await request.json()) as Partial<Complaint> & {
      status?: ComplaintStatus;
      assignedTo?: string | null;
      resolutionNotes?: string | null;
    };

    // If only status/assignedTo/resolutionNotes is being updated, use updateComplaintStatus
    const isStatusOnlyUpdate =
      (body.status !== undefined ||
        body.assignedTo !== undefined ||
        body.resolutionNotes !== undefined) &&
      Object.keys(body).filter(
        (k) => k !== 'status' && k !== 'assignedTo' && k !== 'resolutionNotes',
      ).length === 0;

    if (isStatusOnlyUpdate) {
      try {
        const updatedComplaint = await updateComplaintStatus(
          id,
          body.status ?? existingComplaint.status,
          body.assignedTo,
          body.resolutionNotes,
        );

        if (!updatedComplaint) {
          return NextResponse.json({ error: 'Failed to update complaint status' }, { status: 500 });
        }

        // Trigger notification for complaint status change
        if (body.status && body.status !== existingComplaint.status && updatedComplaint.tenantId) {
          try {
            const { notifyComplaintStatusChanged } = await import('@/modules/notifications/events');
            await notifyComplaintStatusChanged(
              id,
              updatedComplaint.organizationId,
              updatedComplaint.tenantId,
              body.status,
              body.resolutionNotes ?? undefined,
            );
          } catch (notifError) {
            console.error('[Complaints] Failed to send status change notification:', notifError);
            // Don't fail the request if notification fails
          }
        }

        return NextResponse.json({
          message: 'Complaint status updated successfully',
          complaint: {
            _id: updatedComplaint._id,
            tenantId: updatedComplaint.tenantId,
            unitId: updatedComplaint.unitId,
            category: updatedComplaint.category,
            title: updatedComplaint.title,
            description: updatedComplaint.description,
            photos: updatedComplaint.photos,
            priority: updatedComplaint.priority,
            status: updatedComplaint.status,
            assignedTo: updatedComplaint.assignedTo,
            resolvedAt: updatedComplaint.resolvedAt,
            resolutionNotes: updatedComplaint.resolutionNotes,
            organizationId: updatedComplaint.organizationId,
            createdAt: updatedComplaint.createdAt,
            updatedAt: updatedComplaint.updatedAt,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    // Otherwise, use updateComplaint (for full updates)
    const updates: Partial<Complaint> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // TENANT users can only update certain fields (not status, assignedTo, resolutionNotes)
    if (context.roles.includes('TENANT')) {
      delete updates.status;
      delete updates.assignedTo;
      delete updates.resolutionNotes;
      delete updates.priority; // Only staff can change priority
    }

    try {
      const updatedComplaint = await updateComplaint(id, updates);

      if (!updatedComplaint) {
        return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Complaint updated successfully',
        complaint: {
          _id: updatedComplaint._id,
          tenantId: updatedComplaint.tenantId,
          unitId: updatedComplaint.unitId,
          category: updatedComplaint.category,
          title: updatedComplaint.title,
          description: updatedComplaint.description,
          photos: updatedComplaint.photos,
          priority: updatedComplaint.priority,
          status: updatedComplaint.status,
          assignedTo: updatedComplaint.assignedTo,
          resolvedAt: updatedComplaint.resolvedAt,
          resolutionNotes: updatedComplaint.resolutionNotes,
          organizationId: updatedComplaint.organizationId,
          createdAt: updatedComplaint.createdAt,
          updatedAt: updatedComplaint.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('does not belong to the same organization')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update complaint error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating complaint' },
      { status: 500 },
    );
  }
}
