import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findUserByEmailOrPhone } from '@/lib/auth/users';
import { createSessionToken, getSessionCookieName } from '@/lib/auth/session';
import { logActivitySafe } from '@/modules/users/activity-logger';

interface LoginRequestBody {
  identifier?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;

    const identifier = body.identifier ?? body.email ?? body.phone ?? '';
    const password = body.password ?? '';

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required' }, { status: 400 });
    }

    const user = await findUserByEmailOrPhone(identifier);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check if user has a password set
    if (!user.passwordHash || user.passwordHash.trim() === '') {
      return NextResponse.json(
        { error: 'Password not set. Please complete sign-up first.' },
        { status: 401 },
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.status && user.status !== 'active') {
      return NextResponse.json({ error: 'User is not active' }, { status: 403 });
    }

    const token = await createSessionToken(user);

    // Log successful login
    await logActivitySafe({
      userId: user._id.toString(),
      organizationId: user.organizationId,
      action: 'login',
      request,
    });

    const response = NextResponse.json(
      {
        message: 'Logged in successfully',
      },
      { status: 200 },
    );

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json({ error: 'Unexpected error while logging in' }, { status: 500 });
  }
}
