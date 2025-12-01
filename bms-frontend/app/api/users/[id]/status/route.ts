import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { updateUserStatus, findUserById } from '@/lib/auth/users';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { UserStatus } from '@/lib/auth/types';

/**
 * PATCH /api/users/[id]/status
 * Update user status.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const body = (await request.json()) as { status: UserStatus; reason?: string };

    if (!body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    // Validate status value
    const validStatuses: UserStatus[] = ['active', 'inactive', 'invited', 'suspended'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Require permission to update users
    requirePermission(context, 'users', 'update');

    // Get existing user to check organization access
    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to same org (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, existingUser.organizationId);
    }

    const updatedUser = await updateUserStatus(userId, body.status);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
    }

    // Log status change
    await logActivitySafe({
      userId: userId,
      organizationId: existingUser.organizationId,
      action: 'status_changed',
      details: {
        changedBy: context.userId,
        newStatus: body.status,
        previousStatus: existingUser.status,
        reason: body.reason || null,
      },
      request,
    });

    return NextResponse.json({
      message: 'User status updated successfully',
      user: {
        id: updatedUser._id.toString(),
        status: updatedUser.status,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Cannot deactivate last ORG_ADMIN')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
  }
}
