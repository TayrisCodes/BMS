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
    > = {};

    if (body.buildingId !== undefined) updates.buildingId = body.buildingId;
    if (body.unitId !== undefined) updates.unitId = body.unitId;
    if (body.incidentType !== undefined) updates.incidentType = body.incidentType;
    if (body.severity !== undefined) updates.severity = body.severity;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.location !== undefined) updates.location = body.location;
    if (body.involvedParties !== undefined) updates.involvedParties = body.involvedParties;
    if (body.status !== undefined) updates.status = body.status;
    if (body.resolvedAt !== undefined) {
      updates.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
    }
    if (body.resolutionNotes !== undefined) updates.resolutionNotes = body.resolutionNotes;
    if (body.resolvedBy !== undefined) updates.resolvedBy = body.resolvedBy;
    if (body.photos !== undefined) updates.photos = body.photos;
    if (body.documents !== undefined) updates.documents = body.documents;
    if (body.linkedVisitorLogId !== undefined) updates.linkedVisitorLogId = body.linkedVisitorLogId;
    if (body.linkedComplaintId !== undefined) updates.linkedComplaintId = body.linkedComplaintId;

    // If resolving, set resolvedBy to current user if not provided
    if (updates.status === 'resolved' && !updates.resolvedBy && context.userId) {
      updates.resolvedBy = context.userId;
    }

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
