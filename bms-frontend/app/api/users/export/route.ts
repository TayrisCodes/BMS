import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getUsersCollection } from '@/lib/auth/users';
import { withOptionalOrganizationScope } from '@/lib/organizations/scoping';
import { getDb } from '@/lib/db';

/**
 * Escape CSV field (wrap in quotes if contains comma, quote, or newline)
 */
function escapeCSVField(field: string | null | undefined): string {
  if (!field) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/users/export
 * Export users to CSV file.
 * Query params: role, status (filters)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to read users
    if (!isSuperAdmin(context) && !context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    const collection = await getUsersCollection();
    const db = await getDb();

    // Build query
    let query: Record<string, unknown> = {};

    // Organization scoping (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      query = withOptionalOrganizationScope(context, {});
    }

    // Role filter
    if (role) {
      query.roles = role;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Fetch all matching users
    const users = await collection
      .find(query as any)
      .sort({ createdAt: -1 })
      .toArray();

    // Get organization names
    const orgIds = [...new Set(users.map((u) => u.organizationId).filter(Boolean))];
    const orgMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { ObjectId } = await import('mongodb');
      const orgs = await db
        .collection('organizations')
        .find({
          _id: { $in: orgIds.map((id) => new ObjectId(id as string)) },
        })
        .toArray();
      orgs.forEach((org: any) => {
        orgMap.set(org._id.toString(), org.name || 'Unknown');
      });
    }

    // Build CSV
    const headers = ['name', 'email', 'phone', 'roles', 'status', 'organization', 'createdAt'];
    const csvRows = [
      headers.join(','), // Header row
      ...users.map((user) => {
        const row = [
          escapeCSVField(user.name),
          escapeCSVField(user.email),
          escapeCSVField(user.phone),
          escapeCSVField((user.roles || []).join(',')),
          escapeCSVField(user.status || 'active'),
          escapeCSVField(user.organizationId ? orgMap.get(user.organizationId) || '' : ''),
          escapeCSVField(user.createdAt ? new Date(user.createdAt).toISOString() : ''),
        ];
        return row.join(',');
      }),
    ];

    const csv = csvRows.join('\n');

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json({ error: 'Failed to export users' }, { status: 500 });
  }
}
