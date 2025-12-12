import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import {
  createSubscription,
  findSubscriptionByOrganizationId,
  getSubscriptionsCollection,
  type CreateSubscriptionInput,
} from '@/lib/subscriptions/subscriptions';
import { updateOrganization } from '@/lib/organizations/organizations';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can list all subscriptions
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const tier = searchParams.get('tier');
    const billingCycle = searchParams.get('billingCycle');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    const collection = await getSubscriptionsCollection();
    const db = await getDb();

    // Build query
    const query: Record<string, unknown> = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (tier && tier !== 'all') {
      query.tier = tier;
    }
    if (billingCycle && billingCycle !== 'all') {
      query.billingCycle = billingCycle;
    }

    // Get total count
    const total = await collection.countDocuments(query);

    // Get subscriptions with pagination
    const skip = (page - 1) * limit;
    const subscriptions = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get organization names for each subscription
    const subscriptionsWithOrgNames = await Promise.all(
      subscriptions.map(async (sub) => {
        const org = await db.collection('organizations').findOne({
          _id: sub.organizationId,
        });
        return {
          id: sub._id.toString(),
          _id: sub._id.toString(),
          organizationId: sub.organizationId,
          organizationName: org?.name || 'Unknown',
          tier: sub.tier,
          status: sub.status,
          billingCycle: sub.billingCycle,
          basePrice: sub.basePrice,
          discountType: sub.discountType,
          discountValue: sub.discountValue,
          price: sub.price,
          currency: sub.currency,
          startDate: sub.startDate,
          endDate: sub.endDate,
          nextBillingDate: sub.nextBillingDate,
          autoRenew: sub.autoRenew,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        };
      }),
    );

    return NextResponse.json({
      subscriptions: subscriptionsWithOrgNames,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List subscriptions error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can create subscriptions
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as CreateSubscriptionInput;

    // Validate required fields
    if (!body.organizationId || !body.tier || !body.billingCycle) {
      return NextResponse.json(
        { error: 'Organization ID, tier, and billing cycle are required' },
        { status: 400 },
      );
    }

    // Check if organization already has an active subscription
    const existing = await findSubscriptionByOrganizationId(body.organizationId);
    if (existing) {
      return NextResponse.json(
        { error: 'Organization already has an active subscription' },
        { status: 400 },
      );
    }

    const subscription = await createSubscription(body);

    // Update organization with subscription ID
    await updateOrganization(body.organizationId, {
      subscriptionId: subscription._id,
    });

    return NextResponse.json(
      {
        subscription: {
          id: subscription._id,
          _id: subscription._id,
          organizationId: subscription.organizationId,
          tier: subscription.tier,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          basePrice: subscription.basePrice,
          discountType: subscription.discountType,
          discountValue: subscription.discountValue,
          price: subscription.price,
          currency: subscription.currency,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          trialEndDate: subscription.trialEndDate,
          autoRenew: subscription.autoRenew,
          maxBuildings: subscription.maxBuildings,
          maxUnits: subscription.maxUnits,
          maxUsers: subscription.maxUsers,
          features: subscription.features,
          nextBillingDate: subscription.nextBillingDate,
          notes: subscription.notes,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
