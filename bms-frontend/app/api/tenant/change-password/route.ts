import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { findUserById, updateUser } from '@/lib/auth/users';
import { validatePassword } from '@/lib/auth/password-policy';
import * as bcrypt from 'bcryptjs';

/**
 * POST /api/tenant/change-password
 * Change password for authenticated tenant user.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only TENANT role can use this endpoint
    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: 'currentPassword and newPassword are required' },
        { status: 400 },
      );
    }

    // Get user
    const user = await findUserById(context.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Validate new password
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

    // Hash new password
    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    // Update password
    await updateUser(user._id, {
      passwordHash,
      passwordChangedAt: new Date(),
    });

    return NextResponse.json({ message: 'Password changed successfully' });
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
