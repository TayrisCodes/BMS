import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies, getCurrentUserFromCookies } from '@/lib/auth/session';
import { findTenantByPhone, updateTenant, findTenantById } from '@/lib/tenants/tenants';
import type { TenantLanguage } from '@/lib/tenants/tenants';

export async function GET() {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    // Return tenant profile data
    return NextResponse.json({
      id: tenant._id.toString(),
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      name: `${tenant.firstName} ${tenant.lastName}`,
      phone: tenant.primaryPhone,
      email: tenant.email || null,
      language: tenant.language || 'en',
      nationalId: tenant.nationalId || null,
      status: tenant.status,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Get tenant profile error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied') || error.message.includes('does not belong')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.roles.includes('TENANT')) {
      return NextResponse.json({ error: 'Forbidden: Tenant access required' }, { status: 403 });
    }

    // Validate organization context
    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get user to find tenant by phone
    const user = await getCurrentUserFromCookies();
    if (!user || !user.phone) {
      return NextResponse.json(
        { error: 'User not found or phone number missing' },
        { status: 404 },
      );
    }

    // Find tenant by phone
    const tenant = await findTenantByPhone(user.phone, organizationId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found. Please contact your building manager.' },
        { status: 404 },
      );
    }

    // Validate tenant belongs to organization
    if (tenant.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Access denied: Tenant does not belong to your organization' },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate allowed fields
    const allowedFields = ['firstName', 'lastName', 'email', 'language'];
    const updates: Partial<{
      firstName: string;
      lastName: string;
      email: string | null;
      language: TenantLanguage;
    }> = {};

    // Only allow updating specific fields
    if (body.firstName !== undefined) {
      if (
        !body.firstName ||
        typeof body.firstName !== 'string' ||
        body.firstName.trim().length === 0
      ) {
        return NextResponse.json(
          { error: 'First name is required and cannot be empty' },
          { status: 400 },
        );
      }
      updates.firstName = body.firstName.trim();
    }

    if (body.lastName !== undefined) {
      if (
        !body.lastName ||
        typeof body.lastName !== 'string' ||
        body.lastName.trim().length === 0
      ) {
        return NextResponse.json(
          { error: 'Last name is required and cannot be empty' },
          { status: 400 },
        );
      }
      updates.lastName = body.lastName.trim();
    }

    if (body.email !== undefined) {
      // Email is optional, but if provided, validate format
      if (body.email !== null && body.email !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }
        updates.email = body.email.trim();
      } else {
        updates.email = null;
      }
    }

    if (body.language !== undefined) {
      // Validate language
      const validLanguages: TenantLanguage[] = ['am', 'en', 'om', 'ti', null];
      if (!validLanguages.includes(body.language)) {
        return NextResponse.json(
          {
            error: `Invalid language. Must be one of: ${validLanguages.filter((l) => l !== null).join(', ')}`,
          },
          { status: 400 },
        );
      }
      updates.language = body.language;
    }

    // Don't allow updating phone number or organizationId (these are managed by admins)
    if (body.phone || body.organizationId) {
      return NextResponse.json(
        { error: 'Phone number and organization cannot be changed' },
        { status: 400 },
      );
    }

    // Update tenant
    const updatedTenant = await updateTenant(tenant._id.toString(), updates);

    if (!updatedTenant) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Return updated profile
    return NextResponse.json({
      id: updatedTenant._id.toString(),
      firstName: updatedTenant.firstName,
      lastName: updatedTenant.lastName,
      name: `${updatedTenant.firstName} ${updatedTenant.lastName}`,
      phone: updatedTenant.primaryPhone,
      email: updatedTenant.email || null,
      language: updatedTenant.language || 'en',
      nationalId: updatedTenant.nationalId || null,
      status: updatedTenant.status,
      createdAt: updatedTenant.createdAt.toISOString(),
      updatedAt: updatedTenant.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Update tenant profile error:', error);
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Access denied') || error.message.includes('does not belong')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to update profile. Please try again later.' },
      { status: 500 },
    );
  }
}
