import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findTenantById, updateTenant, deleteTenant, type Tenant } from '@/lib/tenants/tenants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tenants/[id]
 * Get a single tenant by ID.
 * Requires tenants.read permission.
 */
export async function GET(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to read tenants
    requirePermission(context, 'tenants', 'read');

    const tenant = await findTenantById(id, context.organizationId || undefined);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, tenant.organizationId);

    return NextResponse.json({
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
        organizationId: tenant.organizationId,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get tenant error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while fetching tenant' }, { status: 500 });
  }
}

/**
 * PATCH /api/tenants/[id]
 * Update a tenant.
 * Requires tenants.update permission.
 */
export async function PATCH(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update tenants
    requirePermission(context, 'tenants', 'update');

    // Get existing tenant to validate organization access
    const existingTenant = await findTenantById(id, context.organizationId || undefined);

    if (!existingTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingTenant.organizationId);

    const body = (await request.json()) as Partial<Tenant>;

    // Remove fields that shouldn't be updated directly
    const updates: Partial<Tenant> = {
      ...body,
    };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdAt;

    // If phone number is being updated, check for duplicates
    if (updates.primaryPhone && updates.primaryPhone !== existingTenant.primaryPhone) {
      const { findTenantByPhone } = await import('@/lib/tenants/tenants');
      const duplicate = await findTenantByPhone(
        updates.primaryPhone,
        existingTenant.organizationId,
      );
      if (duplicate && duplicate._id !== id) {
        return NextResponse.json(
          { error: 'Tenant with this phone number already exists in your organization' },
          { status: 409 },
        );
      }
    }

    const updatedTenant = await updateTenant(id, updates);

    if (!updatedTenant) {
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Tenant updated successfully',
      tenant: {
        _id: updatedTenant._id,
        firstName: updatedTenant.firstName,
        lastName: updatedTenant.lastName,
        primaryPhone: updatedTenant.primaryPhone,
        email: updatedTenant.email,
        nationalId: updatedTenant.nationalId,
        language: updatedTenant.language,
        status: updatedTenant.status,
        emergencyContact: updatedTenant.emergencyContact,
        notes: updatedTenant.notes,
        organizationId: updatedTenant.organizationId,
        createdAt: updatedTenant.createdAt,
        updatedAt: updatedTenant.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update tenant error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Tenant with this phone number already exists' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Unexpected error while updating tenant' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenants/[id]
 * Soft delete a tenant (sets status to inactive).
 * Requires tenants.delete permission.
 */
export async function DELETE(request: Request, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to delete tenants
    requirePermission(context, 'tenants', 'delete');

    // Get existing tenant to validate organization access
    const existingTenant = await findTenantById(id, context.organizationId || undefined);

    if (!existingTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Validate organization access
    validateOrganizationAccess(context, existingTenant.organizationId);

    const deleted = await deleteTenant(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Tenant deleted successfully (soft delete - status set to inactive)',
    });
  } catch (error) {
    console.error('Delete tenant error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('does not have an organization ID')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('belongs to a different organization')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Unexpected error while deleting tenant' }, { status: 500 });
  }
}

