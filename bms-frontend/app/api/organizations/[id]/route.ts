import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import {
  findOrganizationById,
  updateOrganization,
  deleteOrganization,
  findOrganizationByCode,
  type UpdateOrganizationInput,
} from '@/lib/organizations/organizations';
import { isSuperAdmin } from '@/lib/auth/authz';
import { getDb } from '@/lib/db';
import { findSubscriptionByOrganizationId } from '@/lib/subscriptions/subscriptions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can view organization details
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get additional stats
    const db = await getDb();
    const [buildingsCount, usersCount, tenantsCount, leasesCount, invoicesCount, paymentsCount] =
      await Promise.all([
        db.collection('buildings').countDocuments({ organizationId: id }),
        db.collection('users').countDocuments({ organizationId: id }),
        db.collection('tenants').countDocuments({ organizationId: id }),
        db.collection('leases').countDocuments({ organizationId: id }),
        db.collection('invoices').countDocuments({ organizationId: id }),
        db.collection('payments').countDocuments({ organizationId: id }),
      ]);

    // Get subscription if exists
    const subscription = await findSubscriptionByOrganizationId(id);

    // Get admin users for this organization
    const adminUsers = await db
      .collection('users')
      .find({
        organizationId: id,
        roles: 'ORG_ADMIN',
        status: { $in: ['active', 'invited'] },
      })
      .limit(10)
      .toArray();

    // Calculate revenue
    const revenueResult = await db
      .collection('payments')
      .aggregate([
        { $match: { organizationId: id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .toArray();
    const totalRevenue = revenueResult[0]?.total || 0;

    // Calculate pending invoices
    const pendingInvoices = await db
      .collection('invoices')
      .countDocuments({ organizationId: id, status: { $in: ['sent', 'overdue'] } });

    return NextResponse.json({
      organization: {
        id: organization._id,
        _id: organization._id,
        name: organization.name,
        code: organization.code,
        contactInfo: organization.contactInfo,
        settings: organization.settings,
        status: organization.status || 'active',
        subscriptionId: organization.subscriptionId || null,
        domain: organization.domain || null,
        subdomain: organization.subdomain || null,
        branding: organization.branding || null,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
      subscription: subscription
        ? {
            id: subscription._id,
            tier: subscription.tier,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            price: subscription.price,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            nextBillingDate: subscription.nextBillingDate,
            autoRenew: subscription.autoRenew,
          }
        : null,
      adminUsers: adminUsers.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
      })),
      stats: {
        buildings: buildingsCount,
        users: usersCount,
        tenants: tenantsCount,
        leases: leasesCount,
        invoices: invoicesCount,
        payments: paymentsCount,
        totalRevenue,
        pendingInvoices,
      },
    });
  } catch (error) {
    console.error('Organization detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can update organizations
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateOrganizationInput;

    // Check if code is being changed and if it already exists
    if (body.code) {
      const existing = await findOrganizationByCode(body.code);
      if (existing && existing._id !== id) {
        return NextResponse.json({ error: 'Organization code already exists' }, { status: 400 });
      }
    }

    // Check if subdomain is being changed and if it already exists
    if (body.subdomain) {
      const { findOrganizationBySubdomain } = await import('@/lib/organizations/organizations');
      const existing = await findOrganizationBySubdomain(body.subdomain);
      if (existing && existing._id !== id) {
        return NextResponse.json({ error: 'Subdomain already exists' }, { status: 400 });
      }
    }

    // Check if domain is being changed and if it already exists
    if (body.domain) {
      const { findOrganizationByDomain } = await import('@/lib/organizations/organizations');
      const existing = await findOrganizationByDomain(body.domain);
      if (existing && existing._id !== id) {
        return NextResponse.json({ error: 'Domain already exists' }, { status: 400 });
      }
    }

    const organization = await updateOrganization(id, body);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: organization._id,
        _id: organization._id,
        name: organization.name,
        code: organization.code,
        contactInfo: organization.contactInfo,
        settings: organization.settings,
        status: organization.status || 'active',
        subscriptionId: organization.subscriptionId || null,
        domain: organization.domain || null,
        subdomain: organization.subdomain || null,
        branding: organization.branding || null,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can delete organizations
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await deleteOrganization(id);
    if (!success) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
