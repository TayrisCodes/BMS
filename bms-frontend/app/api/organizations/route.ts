import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';
import { isSuperAdmin } from '@/lib/auth/authz';
import {
  createOrganization,
  findOrganizationByCode,
  type CreateOrganizationInput,
} from '@/lib/organizations/organizations';
import { createUser, findUserByEmailOrPhone } from '@/lib/auth/users';
import { validatePassword } from '@/lib/auth/password-policy';
import bcrypt from 'bcryptjs';
import { logActivitySafe } from '@/modules/users/activity-logger';
import {
  createSubscription,
  findSubscriptionByOrganizationId,
  type CreateSubscriptionInput,
} from '@/lib/subscriptions/subscriptions';
import { updateOrganization } from '@/lib/organizations/organizations';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can list all organizations
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const organizations = await db
      .collection('organizations')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org._id.toString(),
        _id: org._id.toString(), // Include both for compatibility
        name: org.name,
        code: org.code,
        contactInfo: org.contactInfo || null,
        status: org.status || 'active',
        subscriptionId: org.subscriptionId || null,
        domain: org.domain || null,
        subdomain: org.subdomain || null,
        branding: org.branding || null,
        createdAt: org.createdAt || new Date(),
        updatedAt: org.updatedAt || org.createdAt || new Date(),
      })),
    });
  } catch (error) {
    console.error('Organizations error:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can create organizations
    if (!isSuperAdmin(context)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as CreateOrganizationInput & {
      adminUser?: {
        name?: string;
        email: string;
        phone: string;
        password: string;
      };
      subscription?: {
        tier: string;
        billingCycle: 'monthly' | 'quarterly' | 'annually';
        trialDays?: number;
        autoRenew?: boolean;
        discountType?: 'percentage' | 'fixed' | null;
        discountValue?: number | null;
      };
      subscriptionId?: string; // For existing subscription
    };

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate that subscription is provided (required for organization)
    if (!body.subscription && !body.subscriptionId) {
      return NextResponse.json(
        { error: 'A subscription is required to create an organization' },
        { status: 400 },
      );
    }

    // Code will be auto-generated if not provided
    const organization = await createOrganization(body);

    // Handle subscription creation or assignment
    // Subscription MUST be created/assigned for organization to function
    let subscription = null;
    if (body.subscription) {
      // Validate subscription data
      if (!body.subscription.tier || !body.subscription.billingCycle) {
        return NextResponse.json(
          { error: 'Subscription tier and billing cycle are required' },
          { status: 400 },
        );
      }

      // Create new subscription for this organization
      // Check if organization already has an active subscription
      const existing = await findSubscriptionByOrganizationId(organization._id.toString());
      if (existing) {
        // If organization already has subscription, use it
        subscription = existing;
      } else {
        // Create new subscription
        const subscriptionInput: CreateSubscriptionInput = {
          organizationId: organization._id.toString(),
          tier: body.subscription.tier as any,
          billingCycle: body.subscription.billingCycle,
          trialDays: body.subscription.trialDays ?? 14, // Default 14-day trial
          autoRenew: body.subscription.autoRenew ?? true,
          discountType: body.subscription.discountType,
          discountValue: body.subscription.discountValue,
        };

        subscription = await createSubscription(subscriptionInput);

        // Update organization with subscription ID
        await updateOrganization(organization._id.toString(), {
          subscriptionId: subscription._id,
        });
      }
    } else if (body.subscriptionId) {
      // Assign existing subscription
      const { findSubscriptionById } = await import('@/lib/subscriptions/subscriptions');
      const existingSubscription = await findSubscriptionById(body.subscriptionId);
      if (existingSubscription) {
        // Verify subscription is not already assigned to another organization
        if (
          existingSubscription.organizationId &&
          existingSubscription.organizationId !== organization._id.toString()
        ) {
          return NextResponse.json(
            { error: 'Subscription is already assigned to another organization' },
            { status: 400 },
          );
        }

        // Update subscription directly in database to link to this organization
        const db = await getDb();
        const { ObjectId } = await import('mongodb');
        await db.collection('subscriptions').updateOne(
          { _id: new ObjectId(body.subscriptionId) },
          {
            $set: {
              organizationId: organization._id.toString(),
              updatedAt: new Date(),
            },
          },
        );

        // Update organization with subscription ID
        await updateOrganization(organization._id.toString(), {
          subscriptionId: body.subscriptionId,
        });

        subscription = existingSubscription;
      } else {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }
    }

    // Validate that subscription was created/assigned successfully
    if (!subscription && body.subscriptionId) {
      // If subscriptionId was provided but subscription not found, this is an error
      return NextResponse.json({ error: 'Subscription not found or could not be assigned' }, { status: 404 });
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Failed to create or assign subscription. Organization creation aborted.' },
        { status: 500 },
      );
    }

    // Create Organization Admin user if provided
    // Admin user should be created AFTER subscription to ensure they have access to subscription info
    let adminUser = null;
    if (body.adminUser) {
      const { name, email, phone, password } = body.adminUser;

      // Validate required fields
      if (!email || !phone || !password) {
        return NextResponse.json(
          { error: 'Admin user email, phone, and password are required' },
          { status: 400 },
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          {
            error: 'Password does not meet requirements',
            details: passwordValidation.errors,
          },
          { status: 400 },
        );
      }

      // Check if email or phone already exists
      const existingUser = await findUserByEmailOrPhone(email.trim());
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email or phone already exists' },
          { status: 409 },
        );
      }

      const existingUserByPhone = await findUserByEmailOrPhone(phone.trim());
      if (existingUserByPhone) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 409 },
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create Organization Admin user
      adminUser = await createUser({
        organizationId: organization._id.toString(),
        email: email.trim(),
        phone: phone.trim(),
        passwordHash,
        roles: ['ORG_ADMIN'],
        status: 'active',
        name: name?.trim() || null,
      });

      // Log admin user creation
      await logActivitySafe({
        userId: adminUser._id.toString(),
        organizationId: organization._id.toString(),
        action: 'user_created',
        details: {
          createdBy: context.userId,
          roles: ['ORG_ADMIN'],
          email: email.trim(),
          phone: phone.trim(),
          createdWithOrganization: true,
        },
        request,
      });
    }

    // Fetch updated organization to get subscription ID if it was added
    const { findOrganizationById } = await import('@/lib/organizations/organizations');
    const updatedOrganization = await findOrganizationById(organization._id.toString());

    return NextResponse.json(
      {
        organization: {
          id: updatedOrganization?._id || organization._id,
          _id: updatedOrganization?._id || organization._id,
          name: updatedOrganization?.name || organization.name,
          code: updatedOrganization?.code || organization.code,
          contactInfo: updatedOrganization?.contactInfo || organization.contactInfo,
          status: updatedOrganization?.status || organization.status || 'active',
          subscriptionId: updatedOrganization?.subscriptionId || organization.subscriptionId || null,
          domain: updatedOrganization?.domain || organization.domain || null,
          subdomain: updatedOrganization?.subdomain || organization.subdomain || null,
          branding: updatedOrganization?.branding || organization.branding || null,
          createdAt: updatedOrganization?.createdAt || organization.createdAt,
          updatedAt: updatedOrganization?.updatedAt || organization.updatedAt,
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
              trialEndDate: subscription.trialEndDate,
            }
          : null,
        adminUser: adminUser
          ? {
              id: adminUser._id.toString(),
              email: adminUser.email,
              phone: adminUser.phone,
              name: adminUser.name,
              roles: adminUser.roles,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
