import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import {
  findVisitorLogById,
  updateVisitorLogExit,
  updateVisitorLog,
  type VisitorLog,
} from '@/lib/security/visitor-logs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/visitor-logs/[id]
 * Get a single visitor log by ID.
 * Requires visitorLogs.read permission or appropriate role.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

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

    const visitorLog = await findVisitorLogById(id, context.organizationId || undefined);

    if (!visitorLog) {
      return NextResponse.json({ error: 'Visitor log not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, visitorLog.organizationId);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Get visitor log error', error);
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
      { error: 'Unexpected error while fetching visitor log' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/visitor-logs/[id]
 * Update a visitor log (primarily for logging exit time).
 * Requires visitorLogs.update permission or appropriate role.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update visitor logs
    try {
      requirePermission(context, 'security', 'update');
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

    // Get existing visitor log to validate organization access
    const existingLog = await findVisitorLogById(id, context.organizationId || undefined);

    if (!existingLog) {
      return NextResponse.json({ error: 'Visitor log not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingLog.organizationId);

    const body = (await request.json()) as Partial<VisitorLog>;

    // If exitTime is being set, use the specialized updateVisitorLogExit function
    if (body.exitTime !== undefined && body.exitTime !== null) {
      const exitTime = body.exitTime instanceof Date ? body.exitTime : new Date(body.exitTime);

      try {
        const updatedLog = await updateVisitorLogExit(id, exitTime);

        if (!updatedLog) {
          return NextResponse.json(
            { error: 'Failed to update visitor log exit time' },
            { status: 500 },
          );
        }

        return NextResponse.json({
          message: 'Visitor log exit time updated successfully',
          visitorLog: {
            _id: updatedLog._id,
            organizationId: updatedLog.organizationId,
            buildingId: updatedLog.buildingId,
            visitorName: updatedLog.visitorName,
            visitorPhone: updatedLog.visitorPhone,
            visitorIdNumber: updatedLog.visitorIdNumber,
            hostTenantId: updatedLog.hostTenantId,
            hostUnitId: updatedLog.hostUnitId,
            purpose: updatedLog.purpose,
            vehiclePlateNumber: updatedLog.vehiclePlateNumber,
            parkingSpaceId: updatedLog.parkingSpaceId,
            entryTime: updatedLog.entryTime,
            exitTime: updatedLog.exitTime,
            loggedBy: updatedLog.loggedBy,
            notes: updatedLog.notes,
            createdAt: updatedLog.createdAt,
            updatedAt: updatedLog.updatedAt,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('cannot be before entry time')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
        }
        throw error;
      }
    }

    // For other updates, use the general updateVisitorLog function
    const updates: Partial<VisitorLog> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // Convert date strings to Date objects if present
    if (updates.entryTime && typeof updates.entryTime === 'string') {
      updates.entryTime = new Date(updates.entryTime);
    }
    if (updates.exitTime && typeof updates.exitTime === 'string') {
      updates.exitTime = new Date(updates.exitTime);
    }

    try {
      const updatedLog = await updateVisitorLog(id, updates);

      if (!updatedLog) {
        return NextResponse.json({ error: 'Failed to update visitor log' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Visitor log updated successfully',
        visitorLog: {
          _id: updatedLog._id,
          organizationId: updatedLog.organizationId,
          buildingId: updatedLog.buildingId,
          visitorName: updatedLog.visitorName,
          visitorPhone: updatedLog.visitorPhone,
          visitorIdNumber: updatedLog.visitorIdNumber,
          hostTenantId: updatedLog.hostTenantId,
          hostUnitId: updatedLog.hostUnitId,
          purpose: updatedLog.purpose,
          vehiclePlateNumber: updatedLog.vehiclePlateNumber,
          parkingSpaceId: updatedLog.parkingSpaceId,
          entryTime: updatedLog.entryTime,
          exitTime: updatedLog.exitTime,
          loggedBy: updatedLog.loggedBy,
          notes: updatedLog.notes,
          createdAt: updatedLog.createdAt,
          updatedAt: updatedLog.updatedAt,
        },
      });
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
        if (error.message.includes('cannot be before entry time')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Update visitor log error', error);
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
      { error: 'Unexpected error while updating visitor log' },
      { status: 500 },
    );
  }
}
