import { NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';

export async function GET() {
  const context = await getAuthContextFromCookies();

  if (!context) {
    // Return 200 with null data instead of 401 for better UX
    // This allows the frontend to gracefully handle unauthenticated state
    return NextResponse.json({ auth: null, user: null });
  }

  const user = await getCurrentUserFromCookies();

  if (!user) {
    // User context exists but user document not found - return null
    return NextResponse.json({ auth: null, user: null });
  }

  return NextResponse.json({
    auth: {
      userId: context.userId,
      organizationId: context.organizationId,
      roles: context.roles,
    },
    user: {
      email: user.email,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}
