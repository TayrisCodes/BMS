import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';
import { findOrganizationById } from '@/lib/organizations/organizations';
import { findUserById, updateUserRoles, updateUserStatus, deleteUser } from '@/lib/auth/users';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { UserStatus } from '@/lib/auth/types';
import { ObjectId } from 'mongodb';

/**
 * PATCH /api/organizations/[id]/admins/[userId]
 * Update an organization admin (roles, status).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can update organization admins
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, userId } = await params;

    // Verify organization exists
    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify user exists and is an ORG_ADMIN for this organization
    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.organizationId !== id) {
      return NextResponse.json(
        { error: 'User does not belong to this organization' },
        { status: 400 },
      );
    }

    if (!user.roles.includes('ORG_ADMIN')) {
      return NextResponse.json({ error: 'User is not an organization admin' }, { status: 400 });
    }

    const body = (await request.json()) as {
      status?: UserStatus;
      roles?: string[];
    };

    let updatedUser = user;

    // Update status if provided
    if (body.status !== undefined) {
      // Prevent deactivating last active ORG_ADMIN
      if (body.status === 'inactive' || body.status === 'suspended') {
        const db = await getDb();
        const activeAdmins = await db.collection('users').countDocuments({
          organizationId: id,
          roles: 'ORG_ADMIN',
          status: { $nin: ['inactive', 'suspended'] },
          _id: { $ne: new ObjectId(userId) },
        });

        if (activeAdmins === 0) {
          return NextResponse.json(
            { error: 'Cannot deactivate last active organization admin' },
            { status: 400 },
          );
        }
      }

      const result = await updateUserStatus(userId, body.status);
      if (!result) {
        return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
      }
      updatedUser = result;
    }

    // Log the update
    await logActivitySafe({
      userId: userId,
      organizationId: id,
      action: body.status ? 'status_changed' : 'role_assigned',
      details: {
        updatedBy: context.userId,
        changes: body,
      },
      request,
    });

    return NextResponse.json({
      message: 'Organization admin updated successfully',
      admin: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        roles: updatedUser.roles,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error('Update organization admin error:', error);
    return NextResponse.json({ error: 'Failed to update organization admin' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[id]/admins/[userId]
 * Remove an organization admin (soft delete).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete organization admins
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, userId } = await params;

    // Verify organization exists
    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify user exists and is an ORG_ADMIN for this organization
    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.organizationId !== id) {
      return NextResponse.json(
        { error: 'User does not belong to this organization' },
        { status: 400 },
      );
    }

    if (!user.roles.includes('ORG_ADMIN')) {
      return NextResponse.json({ error: 'User is not an organization admin' }, { status: 400 });
    }

    // Prevent deletion of last active ORG_ADMIN
    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    const activeAdmins = await db.collection('users').countDocuments({
      organizationId: id,
      roles: 'ORG_ADMIN',
      status: { $nin: ['inactive', 'suspended'] },
      _id: { $ne: new ObjectId(userId) },
    });

    if (activeAdmins === 0) {
      return NextResponse.json(
        { error: 'Cannot delete last active organization admin' },
        { status: 400 },
      );
    }

    // Soft delete (set status to inactive)
    const deleted = await deleteUser(userId, true);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete organization admin' }, { status: 500 });
    }

    // Log the deletion
    await logActivitySafe({
      userId: userId,
      organizationId: id,
      action: 'user_deleted',
      details: {
        deletedBy: context.userId,
        wasOrgAdmin: true,
      },
      request,
    });

    return NextResponse.json({
      message: 'Organization admin deleted successfully',
    });
  } catch (error) {
    console.error('Delete organization admin error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Cannot delete')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Failed to delete organization admin' }, { status: 500 });
  }
}
