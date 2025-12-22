import { NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/authz';
import { resolveOrganizationFromSession } from '@/lib/organizations/resolver';
import {
  findOrganizationById,
  updateOrganization,
  type UpdateOrganizationInput,
} from '@/lib/organizations/organizations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/me
 * Get the current user's organization.
 */
export async function GET() {
  try {
    const context = await resolveOrganizationFromSession(true);

    if (!context) {
      return NextResponse.json(
        { error: 'Not authenticated or no organization in session' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      organizationId: context.organizationId,
      organization: context.organization,
    });
  } catch (error) {
    console.error('Get organization error', error);
    return NextResponse.json(
      { error: 'Unexpected error while fetching organization' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/organizations/me
 * Update the current user's organization.
 * Requires ORG_ADMIN role.
 */
export async function PATCH(request: Request) {
  try {
    const context = await getAuthContextFromCookies();

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require ORG_ADMIN role
    requireRole(context, ['ORG_ADMIN']);

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get existing organization to validate
    const existingOrg = await findOrganizationById(organizationId);
    if (!existingOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = (await request.json()) as Partial<UpdateOrganizationInput>;

    // Only allow updating certain fields (not code, subdomain, domain - those require SUPER_ADMIN)
    const updates: UpdateOrganizationInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.contactInfo !== undefined && { contactInfo: body.contactInfo ?? null }),
      ...(body.settings !== undefined && { settings: body.settings ?? null }),
      ...(body.branding !== undefined && { branding: body.branding ?? null }),
    };

    // Remove undefined fields
    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof UpdateOrganizationInput] === undefined) {
        delete updates[key as keyof UpdateOrganizationInput];
      }
    });

    const organization = await updateOrganization(organizationId, updates);
    if (!organization) {
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Organization updated successfully',
      organization: {
        _id: organization._id,
        name: organization.name,
        code: organization.code,
        contactInfo: organization.contactInfo,
        settings: organization.settings,
        status: organization.status || 'active',
        subscriptionId: organization.subscriptionId || null,
        domain: organization.domain || null,
        subdomain: organization.subdomain || null,
        branding: organization.branding || null,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update organization error', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }
    return NextResponse.json(
      { error: 'Unexpected error while updating organization' },
      { status: 500 },
    );
  }
}
