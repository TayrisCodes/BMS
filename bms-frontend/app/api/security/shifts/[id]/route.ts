import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findShiftById,
  updateShift,
  deleteShift,
  type CreateShiftInput,
} from '@/lib/security/shifts';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * GET /api/security/shifts/[id]
 * Get a specific shift.
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
    const shift = await findShiftById(id, context.organizationId);

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Shift fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch shift' }, { status: 500 });
  }
}

/**
 * PUT /api/security/shifts/[id]
 * Update a shift.
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
      CreateShiftInput & { status?: string; checkInTime?: Date | null; checkOutTime?: Date | null }
    > = {};

    if (body.buildingId !== undefined) updates.buildingId = body.buildingId;
    if (body.securityStaffId !== undefined) updates.securityStaffId = body.securityStaffId;
    if (body.shiftType !== undefined) updates.shiftType = body.shiftType;
    if (body.startTime !== undefined) updates.startTime = new Date(body.startTime);
    if (body.endTime !== undefined) updates.endTime = new Date(body.endTime);
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;

    const shift = await updateShift(id, updates, context.organizationId);

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Shift update error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 });
  }
}

/**
 * DELETE /api/security/shifts/[id]
 * Delete a shift.
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
    const deleted = await deleteShift(id, context.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Shift deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 });
  }
}
