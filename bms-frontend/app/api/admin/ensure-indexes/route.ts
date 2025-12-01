import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { ensureAllIndexes } from '@/lib/db/ensure-indexes';

/**
 * POST /api/admin/ensure-indexes
 * Ensure all database indexes are created.
 * Requires SUPER_ADMIN role.
 */
export async function POST() {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only SUPER_ADMIN can initialize indexes
    if (!isSuperAdmin(context)) {
      return NextResponse.json(
        { error: 'Access denied: SUPER_ADMIN role required' },
        { status: 403 },
      );
    }

    await ensureAllIndexes();

    return NextResponse.json({
      message: 'All database indexes ensured successfully',
    });
  } catch (error) {
    console.error('Ensure indexes error', error);
    return NextResponse.json({ error: 'Unexpected error while ensuring indexes' }, { status: 500 });
  }
}

