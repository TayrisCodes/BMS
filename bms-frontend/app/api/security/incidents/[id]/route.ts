import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findIncidentById,
  updateIncident,
  deleteIncident,
  type CreateIncidentInput,
} from '@/lib/security/incidents';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * GET /api/security/incidents/[id]
 * Get a specific incident.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission/role guard
    try {
      requirePermission(context, 'security', 'read');
    } catch {
      const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
      if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { id } = await params;
    const incident = await findIncidentById(id, context.organizationId);

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: incident._id,
      organizationId: incident.organizationId,
      buildingId: incident.buildingId,
      unitId: incident.unitId || null,
      incidentType: incident.incidentType,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      location: incident.location || null,
      reportedBy: incident.reportedBy,
      reportedAt: incident.reportedAt,
      involvedParties: incident.involvedParties || null,
      status: incident.status,
      resolvedAt: incident.resolvedAt || null,
      resolutionNotes: incident.resolutionNotes || null,
      resolvedBy: incident.resolvedBy || null,
      photos: incident.photos || null,
      documents: incident.documents || null,
      linkedVisitorLogId: incident.linkedVisitorLogId || null,
      linkedComplaintId: incident.linkedComplaintId || null,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
    });
  } catch (error) {
    console.error('Incident fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch incident' }, { status: 500 });
  }
}

/**
 * PUT /api/security/incidents/[id]
 * Update an incident.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission/role guard
    try {
      requirePermission(context, 'security', 'update');
    } catch {
      const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
      if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { id } = await params;
    const body = await request.json();

    const updates: Partial<
      CreateIncidentInput & {
        status?: string;
        resolvedAt?: Date | null;
        resolutionNotes?: string | null;
        resolvedBy?: string | null;
        photos?: string[] | null;
        documents?: string[] | null;
      }
    > = {
      buildingId: body.buildingId !== undefined ? body.buildingId : undefined,
      unitId: body.unitId !== undefined ? body.unitId : undefined,
      incidentType: body.incidentType !== undefined ? body.incidentType : undefined,
      severity: body.severity !== undefined ? body.severity : undefined,
      title: body.title !== undefined ? body.title : undefined,
      description: body.description !== undefined ? body.description : undefined,
      location: body.location !== undefined ? body.location : undefined,
      involvedParties: body.involvedParties !== undefined ? body.involvedParties : undefined,
      status: body.status !== undefined ? body.status : undefined,
      resolvedAt:
        body.resolvedAt !== undefined
          ? body.resolvedAt
            ? new Date(body.resolvedAt)
            : null
          : undefined,
      resolutionNotes: body.resolutionNotes !== undefined ? body.resolutionNotes : undefined,
      resolvedBy: body.resolvedBy !== undefined ? body.resolvedBy : undefined,
      photos: body.photos !== undefined ? body.photos : undefined,
      documents: body.documents !== undefined ? body.documents : undefined,
      linkedVisitorLogId:
        body.linkedVisitorLogId !== undefined ? body.linkedVisitorLogId : undefined,
      linkedComplaintId: body.linkedComplaintId !== undefined ? body.linkedComplaintId : undefined,
    };

    // If resolving, set resolvedBy to current user if not provided
    if (updates.status === 'resolved' && !updates.resolvedBy && context.userId) {
      updates.resolvedBy = context.userId;
    }

    // Remove undefined values
    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof typeof updates] === undefined) {
        delete updates[key as keyof typeof updates];
      }
    });

    const incident = await updateIncident(id, updates, context.organizationId);

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: incident._id,
      organizationId: incident.organizationId,
      buildingId: incident.buildingId,
      unitId: incident.unitId || null,
      incidentType: incident.incidentType,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      location: incident.location || null,
      reportedBy: incident.reportedBy,
      reportedAt: incident.reportedAt,
      involvedParties: incident.involvedParties || null,
      status: incident.status,
      resolvedAt: incident.resolvedAt || null,
      resolutionNotes: incident.resolutionNotes || null,
      resolvedBy: incident.resolvedBy || null,
      photos: incident.photos || null,
      documents: incident.documents || null,
      linkedVisitorLogId: incident.linkedVisitorLogId || null,
      linkedComplaintId: incident.linkedComplaintId || null,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
    });
  } catch (error) {
    console.error('Incident update error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}

/**
 * DELETE /api/security/incidents/[id]
 * Delete an incident.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission/role guard
    try {
      requirePermission(context, 'security', 'delete');
    } catch {
      const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
      if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { id } = await params;
    const deleted = await deleteIncident(id, context.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Incident deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete incident' }, { status: 500 });
  }
}

