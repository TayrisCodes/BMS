import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { updateUserRoles, findUserById } from '@/lib/auth/users';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { UserRole } from '@/lib/auth/types';

/**
 * PATCH /api/users/[id]/roles
 * Update user roles.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const body = (await request.json()) as { roles: UserRole[] };

    if (!body.roles || !Array.isArray(body.roles)) {
      return NextResponse.json({ error: 'roles must be an array' }, { status: 400 });
    }

    // Require permission to assign roles
    requirePermission(context, 'users', 'assign_roles');

    // Get existing user to check organization access
    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to same org (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, existingUser.organizationId);
    }

    const updatedUser = await updateUserRoles(userId, body.roles);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user roles' }, { status: 500 });
    }

    // Log role assignment
    await logActivitySafe({
      userId: userId,
      organizationId: existingUser.organizationId,
      action: 'role_assigned',
      details: {
        assignedBy: context.userId,
        roles: body.roles,
        previousRoles: existingUser.roles,
      },
      request,
    });

    return NextResponse.json({
      message: 'User roles updated successfully',
      user: {
        id: updatedUser._id.toString(),
        roles: updatedUser.roles,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update user roles error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Cannot remove last ORG_ADMIN')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to update user roles' }, { status: 500 });
  }
}
