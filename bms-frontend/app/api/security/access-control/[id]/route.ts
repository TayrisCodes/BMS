import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import {
  findAccessPermissionById,
  updateAccessPermission,
  deleteAccessPermission,
  type CreateAccessPermissionInput,
} from '@/lib/security/access-control';

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER'];

/**
 * GET /api/security/access-control/[id]
 * Get a specific access permission.
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
    const permission = await findAccessPermissionById(id, context.organizationId);

    if (!permission) {
      return NextResponse.json({ error: 'Access permission not found' }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Access permission fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch access permission' }, { status: 500 });
  }
}

/**
 * PUT /api/security/access-control/[id]
 * Update an access permission.
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

    const updates: Partial<CreateAccessPermissionInput> = {
      ...(body.buildingId !== undefined && { buildingId: body.buildingId }),
      ...(body.entityType !== undefined && { entityType: body.entityType }),
      ...(body.entityId !== undefined && { entityId: body.entityId }),
      ...(body.accessLevel !== undefined && { accessLevel: body.accessLevel }),
      ...(body.restrictions !== undefined && { restrictions: body.restrictions }),
      ...(body.validFrom !== undefined && {
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
      }),
      ...(body.validUntil !== undefined && {
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
    };

    // Remove undefined values
    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof typeof updates] === undefined) {
        delete updates[key as keyof typeof updates];
      }
    });

    const permission = await updateAccessPermission(id, updates, context.organizationId);

    if (!permission) {
      return NextResponse.json({ error: 'Access permission not found' }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Access permission update error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update access permission' }, { status: 500 });
  }
}

/**
 * DELETE /api/security/access-control/[id]
 * Delete an access permission.
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
    const deleted = await deleteAccessPermission(id, context.organizationId);

    if (!deleted) {
      return NextResponse.json({ error: 'Access permission not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Access permission deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete access permission' }, { status: 500 });
  }
}
