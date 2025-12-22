import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findShiftById, checkOutShift } from '@/lib/security/shifts';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * POST /api/security/shifts/[id]/check-out
 * Check out from a shift.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const checkOutTime = body.checkOutTime ? new Date(body.checkOutTime) : undefined;

    const shift = await checkOutShift(id, checkOutTime);

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found or cannot check out' }, { status: 404 });
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
    console.error('Shift check-out error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to check out from shift' }, { status: 500 });
  }
}
