import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName, getAuthContextFromCookies } from '@/lib/auth/session';
import { logActivitySafe } from '@/modules/users/activity-logger';

export async function POST(request: NextRequest) {
  const context = await getAuthContextFromCookies();

  // Log logout if user is authenticated
  if (context) {
    await logActivitySafe({
      userId: context.userId,
      organizationId: context.organizationId ?? null,
      action: 'logout',
      request,
    });
  }

  const response = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });

  response.cookies.set(getSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expire immediately
  });

  return response;
}
