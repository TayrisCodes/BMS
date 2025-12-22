import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findSecurityStaffById,
  updateSecurityStaff,
  deleteSecurityStaff,
  type CreateSecurityStaffInput,
} from '@/lib/security/security-staff';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER'];

/**
 * GET /api/security/staff/[id]
 * Get a specific security staff profile.
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
    const staff = await findSecurityStaffById(id, context.organizationId);

    if (!staff) {
      return NextResponse.json({ error: 'Security staff not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: staff._id,
      userId: staff.userId,
      organizationId: staff.organizationId,
      buildingId: staff.buildingId || null,
      assignedBuildings: staff.assignedBuildings || [],
      employeeId: staff.employeeId || null,
      badgeNumber: staff.badgeNumber || null,
      hireDate: staff.hireDate || null,
      emergencyContact: staff.emergencyContact || null,
      certifications: staff.certifications || null,
      notes: staff.notes || null,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    });
  } catch (error) {
    console.error('Security staff fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch security staff' }, { status: 500 });
  }
}

/**
 * PUT /api/security/staff/[id]
 * Update a security staff profile.
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

    const updates: Partial<CreateSecurityStaffInput> = {};

    if (body.buildingId !== undefined) updates.buildingId = body.buildingId;
    if (body.assignedBuildings !== undefined) updates.assignedBuildings = body.assignedBuildings;
    if (body.employeeId !== undefined) updates.employeeId = body.employeeId;
    if (body.badgeNumber !== undefined) updates.badgeNumber = body.badgeNumber;
    if (body.hireDate !== undefined) {
      updates.hireDate = body.hireDate ? new Date(body.hireDate) : null;
    }
    if (body.emergencyContact !== undefined) updates.emergencyContact = body.emergencyContact;
    if (body.certifications !== undefined) updates.certifications = body.certifications;
    if (body.notes !== undefined) updates.notes = body.notes;

    const staff = await updateSecurityStaff(id, updates, context.organizationId);

    if (!staff) {
      return NextResponse.json({ error: 'Security staff not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: staff._id,
      userId: staff.userId,
      organizationId: staff.organizationId,
      buildingId: staff.buildingId || null,
      assignedBuildings: staff.assignedBuildings || [],
      employeeId: staff.employeeId || null,
      badgeNumber: staff.badgeNumber || null,
      hireDate: staff.hireDate || null,
      emergencyContact: staff.emergencyContact || null,
      certifications: staff.certifications || null,
      notes: staff.notes || null,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    });
  } catch (error) {
    console.error('Security staff update error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update security staff' }, { status: 500 });
  }
}

/**
 * DELETE /api/security/staff/[id]
 * Delete a security staff profile.
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
    const deleted = await deleteSecurityStaff(id, context.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Security staff not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Security staff deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete security staff' }, { status: 500 });
  }
}
