import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/modules/users/password-reset-service';

/**
 * POST /api/auth/forgot-password
 * Request password reset.
 * This is a public endpoint (no authentication required).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      emailOrPhone: string;
    };

    // Validate required fields
    if (!body.emailOrPhone) {
      return NextResponse.json({ error: 'emailOrPhone is required' }, { status: 400 });
    }

    // Request password reset
    // Always returns success message (don't reveal if user exists)
    const result = await requestPasswordReset(body.emailOrPhone);

    return NextResponse.json({
      message: result.message,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Even on error, return generic success message for security
    return NextResponse.json({
      message:
        'If an account exists with that email or phone, a password reset link has been sent.',
    });
  }
}
