import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createShift,
  listShifts,
  findShiftsByBuilding,
  findShiftsBySecurityStaff,
  findActiveShifts,
  type CreateShiftInput,
} from '@/lib/security/shifts';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * GET /api/security/shifts
 * List shifts for the organization, building, or security staff.
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
    const securityStaffId = searchParams.get('securityStaffId');
    const status = searchParams.get('status');
    const active = searchParams.get('active') === 'true';

    let shifts;
    if (active) {
      shifts = await findActiveShifts(
        securityStaffId || undefined,
        buildingId || undefined,
        context.organizationId,
      );
    } else if (buildingId) {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      shifts = await findShiftsByBuilding(buildingId, context.organizationId, filters);
    } else if (securityStaffId) {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      shifts = await findShiftsBySecurityStaff(securityStaffId, context.organizationId, filters);
    } else {
      const filters: Record<string, unknown> = {};
      if (status) {
        filters.status = status;
      }
      shifts = await listShifts(context.organizationId, filters);
    }

    return NextResponse.json({
      shifts: shifts.map((s) => ({
        id: s._id,
        organizationId: s.organizationId,
        buildingId: s.buildingId,
        securityStaffId: s.securityStaffId,
        shiftType: s.shiftType,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        notes: s.notes || null,
        checkInTime: s.checkInTime || null,
        checkOutTime: s.checkOutTime || null,
        createdBy: s.createdBy,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Shifts list error:', error);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

/**
 * POST /api/security/shifts
 * Create a new shift.
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

    const input: CreateShiftInput = {
      organizationId: context.organizationId,
      buildingId: body.buildingId,
      securityStaffId: body.securityStaffId,
      shiftType: body.shiftType,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      status: body.status,
      notes: body.notes || null,
      createdBy: context.userId,
    };

    const shift = await createShift(input);

    return NextResponse.json(
      {
        id: shift._id,
        organizationId: shift.organizationId,
        buildingId: shift.buildingId,
        securityStaffId: shift.securityStaffId,
        shiftType: shift.shiftType,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: shift.status,
        notes: shift.notes || null,
        checkInTime: shift.checkInTime || null,
        checkOutTime: shift.checkOutTime || null,
        createdBy: shift.createdBy,
        createdAt: shift.createdAt,
        updatedAt: shift.updatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Shift creation error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
  }
}

