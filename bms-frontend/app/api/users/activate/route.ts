import { NextRequest, NextResponse } from 'next/server';
import { activateUser, validateInvitationToken } from '@/modules/users/invitation-service';
import { logActivitySafe } from '@/modules/users/activity-logger';

/**
 * POST /api/users/activate
 * Activate user account with invitation token and password.
 * This is a public endpoint (no authentication required).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token: string;
      password: string;
    };

    // Validate required fields
    if (!body.token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    if (!body.password) {
      return NextResponse.json({ error: 'password is required' }, { status: 400 });
    }

    // Validate password strength
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 },
      );
    }

    // Validate token first
    const user = await validateInvitationToken(body.token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 400 });
    }

    // Activate user
    const activatedUser = await activateUser(body.token, body.password);

    // Log user activation
    await logActivitySafe({
      userId: activatedUser._id.toString(),
      organizationId: activatedUser.organizationId,
      action: 'user_activated',
      request,
    });

    return NextResponse.json({
      message: 'Account activated successfully',
      userId: activatedUser._id.toString(),
    });
  } catch (error) {
    console.error('Activate user error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Invalid or expired')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('Password must be')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Failed to activate account' }, { status: 500 });
  }
}
