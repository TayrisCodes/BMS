import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { getUsersCollection } from '@/lib/auth/users';
import { getTenantsCollection } from '@/lib/tenants/tenants';
import type { NotificationPreferences } from '@/lib/auth/types';

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences.
 */
export async function GET() {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Default preferences
    const defaultPreferences: NotificationPreferences = {
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
      emailTypes: [
        'invoice_created',
        'payment_due',
        'payment_received',
        'complaint_status_changed',
        'lease_expiring',
      ],
      smsTypes: ['invoice_created', 'payment_due', 'payment_received', 'work_order_assigned'],
    };

    // Get preferences from tenant if user is a tenant
    if (context.tenantId) {
      const tenantsCollection = await getTenantsCollection();
      const { ObjectId } = await import('mongodb');

      try {
        const tenant = await tenantsCollection.findOne({
          _id: new ObjectId(context.tenantId),
        } as any);

        if (tenant && tenant.notificationPreferences) {
          return NextResponse.json({
            preferences: tenant.notificationPreferences,
            source: 'tenant',
          });
        }
      } catch {
        // Tenant not found or invalid ID
      }
    }

    // Get preferences from user if available
    if (context.userId) {
      const usersCollection = await getUsersCollection();
      const { ObjectId } = await import('mongodb');

      try {
        const user = await usersCollection.findOne({
          _id: new ObjectId(context.userId),
        } as any);

        if (user && user.notificationPreferences) {
          return NextResponse.json({
            preferences: user.notificationPreferences,
            source: 'user',
          });
        }
      } catch {
        // User not found or invalid ID
      }
    }

    // Return default preferences if none found
    return NextResponse.json({
      preferences: defaultPreferences,
      source: 'default',
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return NextResponse.json({ error: 'Failed to get notification preferences' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update current user's notification preferences.
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<NotificationPreferences>;

    // Validate preferences
    const preferences: NotificationPreferences = {
      emailEnabled: body.emailEnabled ?? true,
      smsEnabled: body.smsEnabled ?? true,
      inAppEnabled: body.inAppEnabled ?? true,
      emailTypes: Array.isArray(body.emailTypes) ? body.emailTypes : [],
      smsTypes: Array.isArray(body.smsTypes) ? body.smsTypes : [],
    };

    const { ObjectId } = await import('mongodb');

    // Update tenant preferences if user is a tenant
    if (context.tenantId) {
      const tenantsCollection = await getTenantsCollection();

      try {
        const result = await tenantsCollection.updateOne(
          { _id: new ObjectId(context.tenantId) } as any,
          {
            $set: {
              notificationPreferences: preferences,
              updatedAt: new Date(),
            },
          } as any,
        );

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
          return NextResponse.json({
            message: 'Notification preferences updated successfully',
            preferences,
            source: 'tenant',
          });
        }
      } catch (error) {
        console.error('Failed to update tenant preferences:', error);
      }
    }

    // Update user preferences if available
    if (context.userId) {
      const usersCollection = await getUsersCollection();

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(context.userId) } as any,
          {
            $set: {
              notificationPreferences: preferences,
              updatedAt: new Date(),
            },
          } as any,
        );

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
          return NextResponse.json({
            message: 'Notification preferences updated successfully',
            preferences,
            source: 'user',
          });
        }
      } catch (error) {
        console.error('Failed to update user preferences:', error);
      }
    }

    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 },
    );
  } catch (error) {
    console.error('Update notification preferences error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 },
    );
  }
}
