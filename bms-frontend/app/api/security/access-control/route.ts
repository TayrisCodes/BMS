import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  createAccessPermission,
  listAccessPermissions,
  findAccessPermissionsByBuilding,
  findAccessPermissionsByEntity,
  type CreateAccessPermissionInput,
} from '@/lib/security/access-control';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER'];

/**
 * GET /api/security/access-control
 * List access permissions for the organization or building.
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
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    let permissions;
    if (buildingId) {
      permissions = await findAccessPermissionsByBuilding(buildingId, context.organizationId);
    } else if (entityType && entityId) {
      permissions = await findAccessPermissionsByEntity(
        entityType as 'tenant' | 'visitor' | 'staff',
        entityId,
        context.organizationId,
      );
    } else {
      permissions = await listAccessPermissions(context.organizationId);
    }

    return NextResponse.json({
      permissions: permissions.map((p) => ({
        id: p._id,
        organizationId: p.organizationId,
        buildingId: p.buildingId,
        entityType: p.entityType,
        entityId: p.entityId,
        accessLevel: p.accessLevel,
        restrictions: p.restrictions || null,
        validFrom: p.validFrom || null,
        validUntil: p.validUntil || null,
        notes: p.notes || null,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Access control list error:', error);
    return NextResponse.json({ error: 'Failed to fetch access permissions' }, { status: 500 });
  }
}

/**
 * POST /api/security/access-control
 * Create a new access permission.
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

    const input: CreateAccessPermissionInput = {
      organizationId: context.organizationId,
      buildingId: body.buildingId,
      entityType: body.entityType,
      entityId: body.entityId,
      accessLevel: body.accessLevel,
      restrictions: body.restrictions || null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      notes: body.notes || null,
      createdBy: context.userId,
    };

    const permission = await createAccessPermission(input);

    return NextResponse.json(
      {
        id: permission._id,
        organizationId: permission.organizationId,
        buildingId: permission.buildingId,
        entityType: permission.entityType,
        entityId: permission.entityId,
        accessLevel: permission.accessLevel,
        restrictions: permission.restrictions || null,
        validFrom: permission.validFrom || null,
        validUntil: permission.validUntil || null,
        notes: permission.notes || null,
        createdBy: permission.createdBy,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Access permission creation error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create access permission' }, { status: 500 });
  }
}
