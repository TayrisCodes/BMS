import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName, getAuthContextFromCookies } from '@/lib/auth/session';
import { logActivitySafe } from '@/modules/users/activity-logger';

/**
 * POST /api/tenant/logout-all
 * Best-effort logout of the current session cookie (stateless JWT).
 * Logs a logout_all activity.
 */
export async function POST(request: NextRequest) {
  const context = await getAuthContextFromCookies();

  if (context?.roles?.includes('TENANT')) {
    await logActivitySafe({
      userId: context.userId,
      organizationId: context.organizationId ?? null,
      action: 'logout',
      details: { type: 'logout_all' },
      request,
    });
  }

  const response = NextResponse.json({ message: 'Logged out of current session' }, { status: 200 });
  response.cookies.set(getSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
