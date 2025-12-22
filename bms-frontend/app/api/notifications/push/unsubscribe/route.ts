import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getUsersCollection } from '@/lib/auth/users';
import { getTenantsCollection } from '@/lib/tenants/tenants';

/**
 * POST /api/notifications/push/unsubscribe
 * Unsubscribe from push notifications.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ObjectId } = await import('mongodb');

    if (context.tenantId) {
      const tenantsCollection = await getTenantsCollection();
      await tenantsCollection.updateOne(
        { _id: new ObjectId(context.tenantId) } as any,
        {
          $unset: { pushSubscription: '' },
          $set: { updatedAt: new Date() },
        } as any,
      );
    }

    if (context.userId) {
      const usersCollection = await getUsersCollection();
      await usersCollection.updateOne(
        { _id: new ObjectId(context.userId) } as any,
        {
          $unset: { pushSubscription: '' },
          $set: { updatedAt: new Date() },
        } as any,
      );
    }

    return NextResponse.json({ message: 'Successfully unsubscribed from push notifications' });
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe from push notifications' },
      { status: 500 },
    );
  }
}
