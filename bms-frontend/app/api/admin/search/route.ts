import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all'; // all, organizations, users, buildings, tenants

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const db = await getDb();
    const results: Array<{
      id: string;
      type: string;
      title: string;
      subtitle?: string;
      path: string;
    }> = [];

    const searchRegex = new RegExp(query, 'i');

    // Search organizations (SUPER_ADMIN only)
    if (isSuperAdmin(context) && (type === 'all' || type === 'organizations')) {
      const organizations = await db
        .collection('organizations')
        .find({
          $or: [{ name: searchRegex }, { code: searchRegex }, { 'contactInfo.email': searchRegex }],
        })
        .limit(5)
        .toArray();

      for (const org of organizations) {
        results.push({
          id: org._id.toString(),
          type: 'organization',
          title: org.name,
          subtitle: `Code: ${org.code}`,
          path: `/admin/organizations/${org._id}`,
        });
      }
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const users = await db
        .collection('users')
        .find({
          $or: [{ email: searchRegex }, { phone: searchRegex }, { name: searchRegex }],
        })
        .limit(5)
        .toArray();

      for (const user of users) {
        const orgPath = isSuperAdmin(context) ? '/admin/users' : '/org/users';
        results.push({
          id: user._id.toString(),
          type: 'user',
          title: user.name || user.email || user.phone,
          subtitle: user.email || user.phone,
          path: `${orgPath}/${user._id}`,
        });
      }
    }

    // Search buildings
    if (type === 'all' || type === 'buildings') {
      const buildings = await db
        .collection('buildings')
        .find({
          $or: [{ name: searchRegex }, { address: searchRegex }, { code: searchRegex }],
        })
        .limit(5)
        .toArray();

      for (const building of buildings) {
        results.push({
          id: building._id.toString(),
          type: 'building',
          title: building.name,
          subtitle: building.address,
          path: `/org/buildings/${building._id}`,
        });
      }
    }

    // Search tenants
    if (type === 'all' || type === 'tenants') {
      const tenants = await db
        .collection('tenants')
        .find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { primaryPhone: searchRegex },
            { email: searchRegex },
          ],
        })
        .limit(5)
        .toArray();

      for (const tenant of tenants) {
        results.push({
          id: tenant._id.toString(),
          type: 'tenant',
          title: `${tenant.firstName} ${tenant.lastName}`,
          subtitle: tenant.primaryPhone || tenant.email,
          path: `/org/tenants/${tenant._id}`,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to perform search' }, { status: 500 });
  }
}
