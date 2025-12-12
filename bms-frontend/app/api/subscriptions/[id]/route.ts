import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/authz';
import {
  findSubscriptionById,
  updateSubscription,
  cancelSubscription,
  type UpdateSubscriptionInput,
} from '@/lib/subscriptions/subscriptions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can view subscription details
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subscription = await findSubscriptionById(id);
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({
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
        paymentMethod: subscription.paymentMethod,
        lastPaymentDate: subscription.lastPaymentDate,
        nextBillingDate: subscription.nextBillingDate,
        cancellationDate: subscription.cancellationDate,
        cancellationReason: subscription.cancellationReason,
        notes: subscription.notes,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only SUPER_ADMIN can update subscriptions
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateSubscriptionInput;

    const subscription = await updateSubscription(id, body);
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({
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
        cancellationDate: subscription.cancellationDate,
        cancellationReason: subscription.cancellationReason,
        notes: subscription.notes,
        updatedAt: subscription.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
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

    // Only SUPER_ADMIN can cancel subscriptions
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { reason?: string } | null;
    const reason = body?.reason;

    const subscription = await cancelSubscription(id, reason);
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Subscription cancelled successfully',
      subscription: {
        id: subscription._id,
        status: subscription.status,
        cancellationDate: subscription.cancellationDate,
      },
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
