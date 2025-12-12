import { NextResponse } from 'next/server';
import { findValidOtpCode, markOtpAsConsumed } from '@/lib/auth/otp';
import { findTenantByPhone, getTenantsCollection } from '@/lib/tenants/tenants';
import { getUsersCollection } from '@/lib/auth/users';
import type { Document } from 'mongodb';

interface VerifyOtpRequestBody {
  phone?: string;
  code?: string;
  isSignup?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyOtpRequestBody;
    const phone = body.phone?.trim() ?? '';
    const code = body.code?.trim() ?? '';
    const isSignup = body.isSignup ?? false;

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone number and code are required' }, { status: 400 });
    }

    // Validate OTP code
    const otp = await findValidOtpCode(phone, code);
    if (!otp) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // For sign-up, create tenant if doesn't exist
    if (isSignup) {
      let tenant = await findTenantByPhone(phone);

      if (!tenant) {
        // Create new tenant (organizationId will be set later or use default)
        const organizationId = process.env.INIT_ORG_ID ?? 'dev-org-1';
        const { createTenant } = await import('@/lib/tenants/tenants');

        tenant = await createTenant({
          organizationId,
          firstName: '', // Will be updated when password is set
          lastName: '', // Will be updated when password is set
          primaryPhone: phone,
          email: null,
          nationalId: null,
          language: 'en',
          status: 'active',
        });
      }

      // Mark OTP as consumed
      await markOtpAsConsumed(otp._id);

      // Return success - password will be set in next step
      return NextResponse.json(
        {
          message: 'OTP verified. Please set your password.',
          phone: tenant.primaryPhone,
        },
        { status: 200 },
      );
    }

    // For login, verify tenant exists and is active
    const tenant = await findTenantByPhone(phone);
    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Find or create user for tenant (with TENANT role)
    const usersCollection = await getUsersCollection();
    let user = await usersCollection.findOne({
      organizationId: tenant.organizationId,
      phone: tenant.primaryPhone,
    } as Document);

    if (!user) {
      // Create a user record for the tenant if it doesn't exist
      const { createUser, updateUser } = await import('@/lib/auth/users');
      user = await createUser({
        organizationId: tenant.organizationId,
        phone: tenant.primaryPhone,
        email: tenant.email ?? null,
        passwordHash: '', // Will be set when password is set
        roles: ['TENANT'],
        status: 'active',
      });
      // Link user to tenant
      await updateUser(user._id, { tenantId: tenant._id }, false);
    } else if (!user.tenantId) {
      // Link existing user to tenant if not already linked
      const { updateUser } = await import('@/lib/auth/users');
      await updateUser(user._id, { tenantId: tenant._id }, false);
      user.tenantId = tenant._id;
    }

    // Mark OTP as consumed
    await markOtpAsConsumed(otp._id);

    // Create session
    const { createSessionToken, getSessionCookieName } = await import('@/lib/auth/session');
    const token = await createSessionToken(user);

    const response = NextResponse.json(
      {
        message: 'Logged in successfully',
      },
      { status: 200 },
    );

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Verify OTP error', error);
    return NextResponse.json({ error: 'Unexpected error while verifying OTP' }, { status: 500 });
  }
}
