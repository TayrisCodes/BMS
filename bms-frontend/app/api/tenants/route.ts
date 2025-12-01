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

    const body = (await request.json()) as Partial<CreateTenantInput>;

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.primaryPhone) {
      return NextResponse.json(
        { error: 'firstName, lastName, and primaryPhone are required' },
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
