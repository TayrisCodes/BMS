import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { updateUser, findUserById } from '@/lib/auth/users';
import { validatePassword } from '@/lib/auth/password-policy';
import { logActivitySafe } from '@/modules/users/activity-logger';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/change-password
 * Change password for authenticated user.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    // Validate required fields
    if (!body.currentPassword) {
      return NextResponse.json({ error: 'currentPassword is required' }, { status: 400 });
    }

    if (!body.newPassword) {
      return NextResponse.json({ error: 'newPassword is required' }, { status: 400 });
    }

    // Validate new password policy
    const passwordValidation = validatePassword(body.newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'New password does not meet requirements',
          errors: passwordValidation.errors,
        },
        { status: 400 },
      );
    }

    // Get current user
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    if (!user.passwordHash || user.passwordHash.trim() === '') {
      return NextResponse.json(
        { error: 'Current password not set. Please use password reset instead.' },
        { status: 400 },
      );
    }

    const passwordMatches = await bcrypt.compare(body.currentPassword, user.passwordHash);

    if (!passwordMatches) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Check if new password is same as current password
    const isSamePassword = await bcrypt.compare(body.newPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 },
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    // Update password
    const updatedUser = await updateUser(
      user._id.toString(),
      {
        passwordHash,
        passwordChangedAt: new Date(),
      },
      false,
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Log password change
    await logActivitySafe({
      userId: user._id.toString(),
      organizationId: user.organizationId,
      action: 'password_change',
      request,
    });

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Password')) {
        return NextResponse.json(
          {
            error: 'Password validation failed',
            errors: error.message.split('; '),
          },
          { status: 400 },
        );
      }
    }
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
