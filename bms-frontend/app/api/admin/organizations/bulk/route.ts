import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can perform bulk operations
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      organizationIds: string[];
      operation: 'updateStatus' | 'assignSubscription';
      data: {
        status?: 'active' | 'inactive' | 'suspended';
        subscriptionId?: string;
      };
    };

    if (
      !body.organizationIds ||
      !Array.isArray(body.organizationIds) ||
      body.organizationIds.length === 0
    ) {
      return NextResponse.json({ error: 'Organization IDs are required' }, { status: 400 });
    }

    if (!body.operation) {
      return NextResponse.json({ error: 'Operation is required' }, { status: 400 });
    }

    const db = await getDb();
    const collection = db.collection('organizations');

    const objectIds = body.organizationIds.map((id) => new ObjectId(id));
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.operation === 'updateStatus' && body.data.status) {
      updates.status = body.data.status;
    }

    if (body.operation === 'assignSubscription' && body.data.subscriptionId) {
      updates.subscriptionId = body.data.subscriptionId;
    }

    const result = await collection.updateMany({ _id: { $in: objectIds } }, { $set: updates });

    return NextResponse.json({
      message: `Successfully updated ${result.modifiedCount} organization(s)`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can export data
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      organizationIds?: string[];
      format?: 'csv' | 'json';
    };

    const db = await getDb();
    const collection = db.collection('organizations');

    const query: Record<string, unknown> = {};
    if (body.organizationIds && body.organizationIds.length > 0) {
      query._id = { $in: body.organizationIds.map((id) => new ObjectId(id)) };
    }

    const organizations = await collection.find(query).toArray();

    // Get related data
    const orgIds = organizations.map((org) => org._id.toString());
    const [buildings, users, subscriptions] = await Promise.all([
      db
        .collection('buildings')
        .find({ organizationId: { $in: orgIds } })
        .toArray(),
      db
        .collection('users')
        .find({ organizationId: { $in: orgIds } })
        .toArray(),
      db
        .collection('subscriptions')
        .find({ organizationId: { $in: orgIds } })
        .toArray(),
    ]);

    const format = body.format || 'json';

    if (format === 'csv') {
      // Generate CSV
      const csvRows = [
        [
          'Organization ID',
          'Name',
          'Code',
          'Email',
          'Phone',
          'Status',
          'Buildings',
          'Users',
          'Subscription',
          'Created At',
        ].join(','),
      ];

      for (const org of organizations) {
        const orgId = org._id.toString();
        const orgBuildings = buildings.filter((b) => b.organizationId === orgId);
        const orgUsers = users.filter((u) => u.organizationId === orgId);
        const orgSubscription = subscriptions.find((s) => s.organizationId === orgId);

        csvRows.push(
          [
            orgId,
            `"${org.name || ''}"`,
            `"${org.code || ''}"`,
            `"${org.contactInfo?.email || ''}"`,
            `"${org.contactInfo?.phone || ''}"`,
            `"${org.status || 'active'}"`,
            orgBuildings.length.toString(),
            orgUsers.length.toString(),
            orgSubscription ? `"${orgSubscription.tier}"` : '',
            new Date(org.createdAt).toISOString(),
          ].join(','),
        );
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="organizations-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // Return JSON
      return NextResponse.json({
        organizations: organizations.map((org) => ({
          id: org._id.toString(),
          name: org.name,
          code: org.code,
          contactInfo: org.contactInfo,
          status: org.status,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          stats: {
            buildings: buildings.filter((b) => b.organizationId === org._id.toString()).length,
            users: users.filter((u) => u.organizationId === org._id.toString()).length,
            subscription:
              subscriptions.find((s) => s.organizationId === org._id.toString())?.tier || null,
          },
        })),
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export organizations' }, { status: 500 });
  }
}
