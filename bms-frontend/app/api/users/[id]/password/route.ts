import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin, requirePermission } from '@/lib/auth/authz';
import { findUserById, updateUser } from '@/lib/auth/users';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { validatePassword } from '@/lib/auth/password-policy';
import { logActivitySafe } from '@/modules/users/activity-logger';
import bcrypt from 'bcryptjs';

/**
 * POST /api/users/[id]/password
 * Admin password reset - allows SUPER_ADMIN or ORG_ADMIN to reset another user's password.
 * Requires authentication and appropriate permissions.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN or ORG_ADMIN can reset passwords
    const canResetPassword = isSuperAdmin(context) || context.roles.includes('ORG_ADMIN');
    if (!canResetPassword) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = params.id;
    const body = (await request.json()) as {
      newPassword: string;
    };

    // Validate required fields
    if (!body.newPassword) {
      return NextResponse.json({ error: 'newPassword is required' }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validatePassword(body.newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        },
        { status: 400 },
      );
    }

    // Get existing user
    const existingUser = await findUserById(userId);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to same org (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, existingUser.organizationId);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    // Update password
    const updatedUser = await updateUser(
      userId,
      {
        passwordHash,
        passwordChangedAt: new Date(),
      },
      isSuperAdmin(context),
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Log password reset
    await logActivitySafe({
      userId: userId,
      organizationId: existingUser.organizationId,
      action: 'password_changed' as any,
      details: {
        resetBy: context.userId,
        resetByRole: isSuperAdmin(context) ? 'SUPER_ADMIN' : 'ORG_ADMIN',
      },
      request,
    });

    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
