import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  createVisitorLog,
  listVisitorLogs,
  findVisitorLogsByBuilding,
  findVisitorLogsByTenant,
  findActiveVisitorLogs,
  type CreateVisitorLogInput,
} from '@/lib/security/visitor-logs';

/**
 * GET /api/visitor-logs
 * List visitor logs with optional filters.
 * Requires visitorLogs.read permission or appropriate role.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read visitor logs
    try {
      requirePermission(context, 'security', 'read');
    } catch {
      // Fallback: Allow SECURITY, BUILDING_MANAGER, FACILITY_MANAGER, ORG_ADMIN to read visitor logs
      if (
        !context.roles.includes('SECURITY') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('FACILITY_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const hostTenantId = searchParams.get('hostTenantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status'); // "active" or "completed"

    let visitorLogs;

    // If status is "active", use findActiveVisitorLogs
    if (status === 'active') {
      visitorLogs = await findActiveVisitorLogs(
        buildingId || undefined,
        context.organizationId || undefined,
      );
    }
    // If buildingId is specified, use findVisitorLogsByBuilding
    else if (buildingId) {
      const filters: Record<string, unknown> = {};
      if (hostTenantId) {
        filters.hostTenantId = hostTenantId;
      }
      if (status === 'completed') {
        filters.exitTime = { $ne: null };
      }
      if (startDate) {
        filters.entryTime = {
          ...((filters.entryTime as Record<string, unknown>) || {}),
          $gte: new Date(startDate),
        };
      }
      if (endDate) {
        filters.entryTime = {
          ...((filters.entryTime as Record<string, unknown>) || {}),
          $lte: new Date(endDate),
        };
      }

      visitorLogs = await findVisitorLogsByBuilding(
        buildingId,
        context.organizationId || undefined,
        filters,
      );
    }
    // If hostTenantId is specified, use findVisitorLogsByTenant
    else if (hostTenantId) {
      const filters: Record<string, unknown> = {};
      if (status === 'completed') {
        filters.exitTime = { $ne: null };
      }
      if (startDate) {
        filters.entryTime = {
          ...((filters.entryTime as Record<string, unknown>) || {}),
          $gte: new Date(startDate),
        };
      }
      if (endDate) {
        filters.entryTime = {
          ...((filters.entryTime as Record<string, unknown>) || {}),
          $lte: new Date(endDate),
        };
      }

      visitorLogs = await findVisitorLogsByTenant(
        hostTenantId,
        context.organizationId || undefined,
        filters,
      );
    }
    // Otherwise, list all visitor logs with organization scope
    else {
      const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

      // Add filters
      if (buildingId) {
        baseQuery.buildingId = buildingId;
      }
      if (hostTenantId) {
        baseQuery.hostTenantId = hostTenantId;
      }
      if (status === 'active') {
        baseQuery.exitTime = null;
      } else if (status === 'completed') {
        baseQuery.exitTime = { $ne: null };
      }
      if (startDate) {
        baseQuery.entryTime = {
          ...((baseQuery.entryTime as Record<string, unknown>) || {}),
          $gte: new Date(startDate),
        };
      }
      if (endDate) {
        baseQuery.entryTime = {
          ...((baseQuery.entryTime as Record<string, unknown>) || {}),
          $lte: new Date(endDate),
        };
      }

      visitorLogs = await listVisitorLogs(baseQuery);
    }

    // Apply additional date filters if provided (in case they were used with buildingId/hostTenantId)
    if (startDate) {
      const start = new Date(startDate);
      visitorLogs = visitorLogs.filter((log) => log.entryTime >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      visitorLogs = visitorLogs.filter((log) => log.entryTime <= end);
    }

    return NextResponse.json({
      visitorLogs: visitorLogs.map((log) => ({
        _id: log._id,
        organizationId: log.organizationId,
        buildingId: log.buildingId,
        visitorName: log.visitorName,
        visitorPhone: log.visitorPhone,
        visitorIdNumber: log.visitorIdNumber,
        hostTenantId: log.hostTenantId,
        hostUnitId: log.hostUnitId,
        purpose: log.purpose,
        vehiclePlateNumber: log.vehiclePlateNumber,
        parkingSpaceId: log.parkingSpaceId,
        entryTime: log.entryTime,
        exitTime: log.exitTime,
        loggedBy: log.loggedBy,
        notes: log.notes,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      })),
      count: visitorLogs.length,
    });
  } catch (error) {
    console.error('Get visitor logs error', error);
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
      { error: 'Unexpected error while fetching visitor logs' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/visitor-logs
 * Create a new visitor log entry.
 * Requires SECURITY or BUILDING_MANAGER role.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create visitor logs
    // SECURITY, BUILDING_MANAGER, or ORG_ADMIN can create
    try {
      requirePermission(context, 'security', 'create');
    } catch {
      // Check if user has appropriate role
      if (
        !context.roles.includes('SECURITY') &&
        !context.roles.includes('BUILDING_MANAGER') &&
        !context.roles.includes('ORG_ADMIN')
      ) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const userId = context.userId;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<CreateVisitorLogInput>;

    // Validate required fields
    if (!body.buildingId || !body.visitorName || !body.hostTenantId || !body.purpose) {
      return NextResponse.json(
        {
          error: 'buildingId, visitorName, hostTenantId, and purpose are required',
        },
        { status: 400 },
      );
    }

    // Create visitor log
    const input: CreateVisitorLogInput = {
      organizationId,
      buildingId: body.buildingId,
      visitorName: body.visitorName,
      visitorPhone: body.visitorPhone ?? null,
      visitorIdNumber: body.visitorIdNumber ?? null,
      hostTenantId: body.hostTenantId,
      hostUnitId: body.hostUnitId ?? null,
      purpose: body.purpose,
      vehiclePlateNumber: body.vehiclePlateNumber ?? null,
      parkingSpaceId: body.parkingSpaceId ?? null,
      ...(body.entryTime && { entryTime: new Date(body.entryTime) }),
      loggedBy: userId,
      notes: body.notes ?? null,
    };

    try {
      const visitorLog = await createVisitorLog(input);

      return NextResponse.json(
        {
          message: 'Visitor log created successfully',
          visitorLog: {
            _id: visitorLog._id,
            organizationId: visitorLog.organizationId,
            buildingId: visitorLog.buildingId,
            visitorName: visitorLog.visitorName,
            visitorPhone: visitorLog.visitorPhone,
            visitorIdNumber: visitorLog.visitorIdNumber,
            hostTenantId: visitorLog.hostTenantId,
            hostUnitId: visitorLog.hostUnitId,
            purpose: visitorLog.purpose,
            vehiclePlateNumber: visitorLog.vehiclePlateNumber,
            parkingSpaceId: visitorLog.parkingSpaceId,
            entryTime: visitorLog.entryTime,
            exitTime: visitorLog.exitTime,
            loggedBy: visitorLog.loggedBy,
            notes: visitorLog.notes,
            createdAt: visitorLog.createdAt,
            updatedAt: visitorLog.updatedAt,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Building not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Tenant not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Unit not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Parking space not found')) {
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
    console.error('Create visitor log error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while creating visitor log' },
      { status: 500 },
    );
  }
}
