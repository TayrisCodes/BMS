import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { createInvitation } from '@/modules/users/invitation-service';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { UserRole } from '@/lib/auth/types';

/**
 * POST /api/users/invite
 * Invite a new user to the system.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to create users
    requirePermission(context, 'users', 'create');

    const body = (await request.json()) as {
      email?: string | null;
      phone: string;
      roles: UserRole[];
      organizationId?: string;
      name?: string | null;
    };

    // Validate required fields
    if (!body.phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    if (!body.roles || !Array.isArray(body.roles) || body.roles.length === 0) {
      return NextResponse.json({ error: 'roles must be a non-empty array' }, { status: 400 });
    }

    // Determine organizationId
    let organizationId: string;
    if (body.organizationId) {
      // SUPER_ADMIN can specify organizationId
      if (!isSuperAdmin(context)) {
        return NextResponse.json(
          { error: 'Only SUPER_ADMIN can specify organizationId' },
          { status: 403 },
        );
      }
      organizationId = body.organizationId;
    } else {
      // Use context organizationId
      if (!context.organizationId) {
        return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
      }
      organizationId = context.organizationId;
    }

    // Validate organization access (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, organizationId);
    }

    // Create invitation
    const result = await createInvitation({
      organizationId,
      email: body.email || null,
      phone: body.phone,
      roles: body.roles,
      invitedBy: context.userId,
      name: body.name || null,
    });

    // Log user invitation
    await logActivitySafe({
      userId: result.user._id.toString(),
      organizationId: result.user.organizationId,
      action: 'user_invited',
      details: {
        invitedBy: context.userId,
        roles: body.roles,
        email: body.email || null,
        phone: body.phone,
      },
      request,
    });

    // In development, return token for testing
    // In production, don't expose the token
    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json(
      {
        message: 'User invitation sent successfully',
        userId: result.user._id.toString(),
        ...(isDev
          ? {
              token: result.token,
              activationUrl: result.activationUrl,
            }
          : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Invite user error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('already exists')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}
