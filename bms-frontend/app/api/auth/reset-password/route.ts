import { NextRequest, NextResponse } from 'next/server';
import { resetPassword, validateResetToken } from '@/modules/users/password-reset-service';
import { validatePassword } from '@/lib/auth/password-policy';

/**
 * POST /api/auth/reset-password
 * Reset password with token.
 * This is a public endpoint (no authentication required).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token: string;
      newPassword: string;
    };

    // Validate required fields
    if (!body.token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    if (!body.newPassword) {
      return NextResponse.json({ error: 'newPassword is required' }, { status: 400 });
    }

    // Validate password policy
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

    // Validate token first
    const user = await validateResetToken(body.token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Reset password
    const updatedUser = await resetPassword(body.token, body.newPassword);

    return NextResponse.json({
      message: 'Password reset successfully',
      userId: updatedUser._id.toString(),
    });
  } catch (error) {
    console.error('Reset password error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Invalid or expired')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
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
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
