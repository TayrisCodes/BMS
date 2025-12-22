import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createIncident,
  listIncidents,
  findIncidentsByBuilding,
  findIncidentsByReporter,
  type CreateIncidentInput,
} from '@/lib/security/incidents';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * GET /api/security/incidents
 * List incidents for the organization or building.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl;
    const buildingId = searchParams.get('buildingId');
    const reportedBy = searchParams.get('reportedBy');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const incidentType = searchParams.get('incidentType');

    let incidents;
    if (buildingId) {
      const filters: Record<string, unknown> = {};
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (incidentType) filters.incidentType = incidentType;
      incidents = await findIncidentsByBuilding(buildingId, context.organizationId, filters);
    } else if (reportedBy) {
      const filters: Record<string, unknown> = {};
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (incidentType) filters.incidentType = incidentType;
      incidents = await findIncidentsByReporter(reportedBy, context.organizationId, filters);
    } else {
      const filters: Record<string, unknown> = {};
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (incidentType) filters.incidentType = incidentType;
      incidents = await listIncidents(context.organizationId, filters);
    }

    return NextResponse.json({
      incidents: incidents.map((i) => ({
        id: i._id,
        organizationId: i.organizationId,
        buildingId: i.buildingId,
        unitId: i.unitId || null,
        incidentType: i.incidentType,
        severity: i.severity,
        title: i.title,
        description: i.description,
        location: i.location || null,
        reportedBy: i.reportedBy,
        reportedAt: i.reportedAt,
        involvedParties: i.involvedParties || null,
        status: i.status,
        resolvedAt: i.resolvedAt || null,
        resolutionNotes: i.resolutionNotes || null,
        resolvedBy: i.resolvedBy || null,
        photos: i.photos || null,
        documents: i.documents || null,
        linkedVisitorLogId: i.linkedVisitorLogId || null,
        linkedComplaintId: i.linkedComplaintId || null,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Incidents list error:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

/**
 * POST /api/security/incidents
 * Create a new incident.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId || !context.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission/role guard
    try {
      requirePermission(context, 'security', 'create');
    } catch {
      const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
      if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();

    const input: CreateIncidentInput = {
      organizationId: context.organizationId,
      buildingId: body.buildingId,
      unitId: body.unitId || null,
      incidentType: body.incidentType,
      severity: body.severity,
      title: body.title,
      description: body.description,
      location: body.location || null,
      reportedBy: context.userId,
      reportedAt: body.reportedAt ? new Date(body.reportedAt) : new Date(),
      involvedParties: body.involvedParties || null,
      status: body.status,
      linkedVisitorLogId: body.linkedVisitorLogId || null,
      linkedComplaintId: body.linkedComplaintId || null,
    };

    const incident = await createIncident(input);

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Incident creation error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}
