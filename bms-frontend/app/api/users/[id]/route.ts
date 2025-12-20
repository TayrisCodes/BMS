import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import {
  updateUser,
  deleteUser,
  findUserById,
  updateUserRoles,
  updateUserStatus,
  findUserByEmailOrPhone,
} from '@/lib/auth/users';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { User, UserRole, UserStatus } from '@/lib/auth/types';

/**
 * GET /api/users/[id]
 * Get single user details.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to same org (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, user.organizationId);
    }

    return NextResponse.json({
      id: user._id.toString(),
      organizationId: user.organizationId,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roles: user.roles || [],
      status: user.status || 'active',
      invitedBy: user.invitedBy,
      invitedAt: user.invitedAt,
      activatedAt: user.activatedAt,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    if (error instanceof Error) {
      if (
        error.message.includes('Access denied') ||
        error.message.includes('belongs to a different organization')
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PATCH /api/users/[id]
 * Update user.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const body = (await request.json()) as Partial<{
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      roles?: UserRole[];
      status?: UserStatus;
      organizationId?: string;
    }>;

    // Get existing user to check permissions
    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to same org (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, existingUser.organizationId);
    }

    // Check permissions
    // Users can update their own profile (name, email, phone)
    // Only ORG_ADMIN/SUPER_ADMIN can update other users
    const isOwnProfile = context.userId === userId;
    const isOrgAdmin = context.roles.includes('ORG_ADMIN');
    const canUpdateOthers = isSuperAdmin(context) || isOrgAdmin;

    // ORG_ADMIN cannot edit other ORG_ADMIN or SUPER_ADMIN users
    if (!isSuperAdmin(context) && !isOwnProfile) {
      const hasRestrictedRole =
        existingUser.roles.includes('ORG_ADMIN') || existingUser.roles.includes('SUPER_ADMIN');
      if (hasRestrictedRole) {
        return NextResponse.json(
          {
            error:
              'You cannot edit users with ORG_ADMIN or SUPER_ADMIN roles. You can only edit your own account.',
          },
          { status: 403 },
        );
      }
    }

    // Check if trying to update roles or status
    const updatingRoles = body.roles !== undefined;
    const updatingStatus = body.status !== undefined;

    // Only ORG_ADMIN/SUPER_ADMIN can update roles
    if (updatingRoles && !canUpdateOthers) {
      requirePermission(context, 'users', 'assign_roles');
    }

    // Only ORG_ADMIN/SUPER_ADMIN can update status
    if (updatingStatus && !canUpdateOthers) {
      requirePermission(context, 'users', 'update');
    }

    // For other fields, check permissions
    if (!isOwnProfile && !canUpdateOthers) {
      requirePermission(context, 'users', 'update');
    }

    // Validate role restrictions for ORG_ADMIN
    if (updatingRoles && !isSuperAdmin(context) && isOrgAdmin) {
      const restrictedRoles: UserRole[] = ['ORG_ADMIN', 'SUPER_ADMIN', 'TENANT'];
      const hasRestrictedRole = body.roles!.some((role) => restrictedRoles.includes(role));

      if (hasRestrictedRole) {
        return NextResponse.json(
          {
            error:
              'You cannot assign ORG_ADMIN, SUPER_ADMIN, or TENANT roles. TENANT accounts must be created through the tenants page.',
          },
          { status: 403 },
        );
      }
    }

    // Validate: can't change organizationId unless SUPER_ADMIN
    if (body.organizationId !== undefined && !isSuperAdmin(context)) {
      return NextResponse.json(
        { error: 'Cannot change organizationId: requires SUPER_ADMIN permission' },
        { status: 403 },
      );
    }

    // Validate phone/email uniqueness
    if (body.phone || body.email) {
      const phoneToCheck = body.phone?.trim() || existingUser.phone;
      const emailToCheck = body.email?.trim() || existingUser.email;

      if (phoneToCheck && phoneToCheck !== existingUser.phone) {
        const existingByPhone = await findUserByEmailOrPhone(phoneToCheck);
        if (
          existingByPhone &&
          existingByPhone._id.toString() !== userId &&
          existingByPhone.organizationId === existingUser.organizationId
        ) {
          return NextResponse.json(
            { error: 'Phone number already exists in this organization' },
            { status: 409 },
          );
        }
      }

      if (emailToCheck && emailToCheck !== existingUser.email) {
        const existingByEmail = await findUserByEmailOrPhone(emailToCheck);
        if (existingByEmail && existingByEmail._id.toString() !== userId) {
          return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
        }
      }
    }

    // Prepare update object (excluding roles and status which are handled separately)
    const updateData: Partial<{
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      organizationId?: string;
    }> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.organizationId !== undefined && isSuperAdmin(context)) {
      updateData.organizationId = body.organizationId;
    }

    let updatedUser = existingUser;

    // Update basic fields if any
    if (Object.keys(updateData).length > 0) {
      const result = await updateUser(userId, updateData as Partial<User>, isSuperAdmin(context));
      if (!result) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
      }
      updatedUser = result;
    }

    // Update roles if provided
    if (updatingRoles) {
      const result = await updateUserRoles(userId, body.roles!);
      if (!result) {
        return NextResponse.json({ error: 'Failed to update user roles' }, { status: 500 });
      }
      updatedUser = result;
    }

    // Update status if provided
    if (updatingStatus) {
      const result = await updateUserStatus(userId, body.status!);
      if (!result) {
        return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
      }
      updatedUser = result;
    }

    // Fetch latest user data to ensure we have all updates
    const finalUser = await findUserById(userId);
    if (!finalUser) {
      return NextResponse.json({ error: 'Failed to fetch updated user' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: finalUser._id.toString(),
        organizationId: finalUser.organizationId,
        email: finalUser.email,
        phone: finalUser.phone,
        name: finalUser.name,
        roles: finalUser.roles,
        status: finalUser.status,
        updatedAt: finalUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Cannot change organizationId')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
        return NextResponse.json({ error: 'Email or phone already exists' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]
 * Soft delete user (set status to inactive).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Require permission to delete users
    requirePermission(context, 'users', 'delete');

    // Get existing user to check organization access
    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to same org (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, existingUser.organizationId);
    }

    // ORG_ADMIN cannot delete other ORG_ADMIN or SUPER_ADMIN users
    if (!isSuperAdmin(context)) {
      const isOrgAdmin = context.roles.includes('ORG_ADMIN');
      if (isOrgAdmin) {
        const hasRestrictedRole =
          existingUser.roles.includes('ORG_ADMIN') || existingUser.roles.includes('SUPER_ADMIN');
        if (hasRestrictedRole) {
          return NextResponse.json(
            {
              error: 'You cannot delete users with ORG_ADMIN or SUPER_ADMIN roles.',
            },
            { status: 403 },
          );
        }
      }
    }

    const deleted = await deleteUser(userId, isSuperAdmin(context));

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    // Log user deletion
    await logActivitySafe({
      userId: userId,
      organizationId: existingUser.organizationId,
      action: 'user_deleted',
      details: {
        deletedBy: context.userId,
        roles: existingUser.roles,
      },
      request,
    });

    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Cannot delete')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('last ORG_ADMIN')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
