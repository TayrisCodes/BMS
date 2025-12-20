import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createSecurityStaff,
  listSecurityStaff,
  findSecurityStaffByBuilding,
  type CreateSecurityStaffInput,
} from '@/lib/security/security-staff';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER'];

/**
 * GET /api/security/staff
 * List security staff for the organization or building.
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

    let staff;
    if (buildingId) {
      staff = await findSecurityStaffByBuilding(buildingId, context.organizationId);
    } else {
      staff = await listSecurityStaff(context.organizationId);
    }

    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s._id,
        userId: s.userId,
        organizationId: s.organizationId,
        buildingId: s.buildingId || null,
        assignedBuildings: s.assignedBuildings || [],
        employeeId: s.employeeId || null,
        badgeNumber: s.badgeNumber || null,
        hireDate: s.hireDate || null,
        emergencyContact: s.emergencyContact || null,
        certifications: s.certifications || null,
        notes: s.notes || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Security staff list error:', error);
    return NextResponse.json({ error: 'Failed to fetch security staff' }, { status: 500 });
  }
}

/**
 * POST /api/security/staff
 * Create a new security staff profile.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId) {
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

    const input: CreateSecurityStaffInput = {
      organizationId: context.organizationId,
      userId: body.userId,
      buildingId: body.buildingId || null,
      assignedBuildings: body.assignedBuildings || [],
      employeeId: body.employeeId || null,
      badgeNumber: body.badgeNumber || null,
      hireDate: body.hireDate ? new Date(body.hireDate) : null,
      emergencyContact: body.emergencyContact || null,
      certifications: body.certifications || null,
      notes: body.notes || null,
    };

    const staff = await createSecurityStaff(input);

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Security staff creation error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create security staff' }, { status: 500 });
  }
}

