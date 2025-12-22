import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import {
  getTenantsCollection,
  createTenant,
  listTenants,
  type CreateTenantInput,
} from '@/lib/tenants/tenants';
import { createUser } from '@/lib/auth/users';
import * as bcrypt from 'bcryptjs';

/**
 * GET /api/tenants
 * List tenants with optional filters.
 * Requires tenants.read permission.
 */
export async function GET(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only staff roles can access tenant list (not TENANT role)
    if (context.roles.includes('TENANT')) {
      return NextResponse.json(
        { error: 'Access denied: Tenants cannot access this resource' },
        { status: 403 },
      );
    }

    // Require permission to read tenants
    requirePermission(context, 'tenants', 'read');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search'); // For name/phone search

    // Build query with organization scope
    const baseQuery: Record<string, unknown> = withOrganizationScope(context, {});

    // Add filters
    if (status) {
      baseQuery.status = status;
    }

    // Search by name or phone
    if (search) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      baseQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { primaryPhone: searchRegex },
        { email: searchRegex },
      ];
    }

    const tenants = await listTenants(baseQuery);

    return NextResponse.json({
      tenants: tenants.map((t) => ({
        _id: t._id,
        firstName: t.firstName,
        lastName: t.lastName,
        primaryPhone: t.primaryPhone,
        email: t.email,
        nationalId: t.nationalId,
        language: t.language,
        status: t.status,
        emergencyContact: t.emergencyContact,
        notes: t.notes,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      count: tenants.length,
    });
  } catch (error) {
    console.error('Get tenants error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('Organization ID is required')) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while fetching tenants' }, { status: 500 });
  }
}

/**
 * POST /api/tenants
 * Create a new tenant.
 * Requires tenants.create permission.
 */
export async function POST(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to create tenants
    requirePermission(context, 'tenants', 'create');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateTenantInput> & {
      password?: string;
      unitId?: string | null;
      leaseData?: {
        startDate: string;
        endDate?: string | null;
        rentAmount: number;
        depositAmount?: number | null;
        billingCycle: 'monthly' | 'quarterly' | 'annually';
        dueDay: number;
      } | null;
    };

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.primaryPhone) {
      return NextResponse.json(
        { error: 'firstName, lastName, and primaryPhone are required' },
        { status: 400 },
      );
    }

    // Password is required for tenant creation
    if (!body.password || body.password.trim().length === 0) {
      return NextResponse.json(
        { error: 'Password is required for tenant account creation' },
        { status: 400 },
      );
    }

    // Validate password strength
    const { validatePassword } = await import('@/lib/auth/password-policy');
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        },
        { status: 400 },
      );
    }

    // Check if tenant with same phone already exists
    const { findTenantByPhone } = await import('@/lib/tenants/tenants');
    const existingTenant = await findTenantByPhone(body.primaryPhone, organizationId);
    if (existingTenant) {
      return NextResponse.json(
        { error: 'Tenant with this phone number already exists in your organization' },
        { status: 409 },
      );
    }

    // Check if user with same phone already exists
    const { findUserByPhone } = await import('@/lib/auth/users');
    const existingUser = await findUserByPhone(body.primaryPhone, organizationId);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this phone number already exists in your organization' },
        { status: 409 },
      );
    }

    // Create tenant
    const input: CreateTenantInput = {
      organizationId,
      firstName: body.firstName,
      lastName: body.lastName,
      primaryPhone: body.primaryPhone,
      email: body.email ?? null,
      nationalId: body.nationalId ?? null,
      language: body.language ?? null,
      status: body.status ?? 'active',
      emergencyContact: body.emergencyContact ?? null,
      notes: body.notes ?? null,
    };

    const tenant = await createTenant(input);

    try {
      // Create user account for tenant
      const passwordHash = await bcrypt.hash(body.password, 10);
      const user = await createUser({
        organizationId,
        phone: body.primaryPhone,
        email: body.email ?? null,
        passwordHash,
        roles: ['TENANT'],
        status: 'active',
      });

      // Link user to tenant
      const { updateUser } = await import('@/lib/auth/users');
      await updateUser(user._id, { tenantId: tenant._id }, false);
    } catch (userError) {
      // If user creation fails, delete the tenant to maintain consistency
      const { deleteTenant } = await import('@/lib/tenants/tenants');
      await deleteTenant(tenant._id);
      console.error('Failed to create user for tenant:', userError);
      throw new Error('Failed to create user account for tenant');
    }

    // Create lease if unitId and leaseData are provided
    if (body.unitId && body.leaseData) {
      try {
        const { createLease } = await import('@/lib/leases/leases');
        await createLease({
          organizationId,
          tenantId: tenant._id,
          unitId: body.unitId,
          startDate: body.leaseData.startDate,
          endDate: body.leaseData.endDate || null,
          billingCycle: body.leaseData.billingCycle,
          dueDay: body.leaseData.dueDay,
          terms: {
            rent: body.leaseData.rentAmount,
            deposit: body.leaseData.depositAmount || null,
          },
          status: 'active',
        });
      } catch (leaseError) {
        console.error('Failed to create lease for tenant:', leaseError);
        // Don't fail the tenant creation if lease creation fails
        // The lease can be created later manually
      }
    }

    return NextResponse.json(
      {
        message: 'Tenant created successfully',
        tenant: {
          _id: tenant._id,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          primaryPhone: tenant.primaryPhone,
          email: tenant.email,
          nationalId: tenant.nationalId,
          language: tenant.language,
          status: tenant.status,
          emergencyContact: tenant.emergencyContact,
          notes: tenant.notes,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create tenant error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Tenant with this phone number already exists' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Unexpected error while creating tenant' }, { status: 500 });
  }
}
