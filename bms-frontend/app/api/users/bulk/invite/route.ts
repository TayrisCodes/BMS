import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { createInvitation } from '@/modules/users/invitation-service';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import { findUserByEmailOrPhone, createUser } from '@/lib/auth/users';
import { validatePassword } from '@/lib/auth/password-policy';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@/lib/auth/types';

const MAX_BATCH_SIZE = 50;

interface BulkInviteUser {
  email?: string;
  phone: string;
  name?: string;
  roles: UserRole[];
}

interface BulkInviteResult {
  userId?: string;
  identifier: string; // email or phone
  success: boolean;
  error?: string;
}

/**
 * POST /api/users/bulk/invite
 * Bulk invite users (up to 50 per batch).
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
      users: BulkInviteUser[];
      createType?: 'invite' | 'direct';
      password?: string; // For direct creation, same password for all
    };

    // Validate batch size
    if (!body.users || !Array.isArray(body.users)) {
      return NextResponse.json({ error: 'users array is required' }, { status: 400 });
    }

    if (body.users.length === 0) {
      return NextResponse.json({ error: 'At least one user is required' }, { status: 400 });
    }

    if (body.users.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} users per batch` },
        { status: 400 },
      );
    }

    // Determine organizationId
    let organizationId: string;
    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }
    organizationId = context.organizationId;

    // Validate organization access (unless SUPER_ADMIN)
    if (!isSuperAdmin(context)) {
      validateOrganizationAccess(context, organizationId);
    }

    // Validate role restrictions for ORG_ADMIN
    const restrictedRoles: UserRole[] = ['ORG_ADMIN', 'SUPER_ADMIN', 'TENANT'];
    if (!isSuperAdmin(context)) {
      const hasRestrictedRole = body.users.some((user) =>
        user.roles.some((role) => restrictedRoles.includes(role)),
      );

      if (hasRestrictedRole) {
        return NextResponse.json(
          {
            error:
              'You cannot create users with ORG_ADMIN, SUPER_ADMIN, or TENANT roles. TENANT accounts must be created through the tenants page.',
          },
          { status: 403 },
        );
      }
    }

    // Validate password if direct creation
    if (body.createType === 'direct') {
      if (!body.password || body.password.trim().length < 8) {
        return NextResponse.json(
          { error: 'Password is required and must be at least 8 characters for direct creation' },
          { status: 400 },
        );
      }

      const passwordValidation = validatePassword(body.password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          {
            error: 'Password does not meet requirements',
            details: passwordValidation.errors,
          },
          { status: 400 },
        );
      }
    }

    // Validate all users before processing
    const validationErrors: Array<{ index: number; error: string }> = [];
    body.users.forEach((user, index) => {
      if (!user.phone || !user.phone.trim()) {
        validationErrors.push({ index, error: 'Phone is required' });
      }
      if (!user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
        validationErrors.push({ index, error: 'At least one role is required' });
      }
      if (body.createType === 'invite' && !user.email) {
        validationErrors.push({ index, error: 'Email is required for invitations' });
      }
      if (user.email && user.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email.trim())) {
          validationErrors.push({ index, error: 'Invalid email format' });
        }
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation errors found',
          validationErrors,
        },
        { status: 400 },
      );
    }

    // Process users
    const results: BulkInviteResult[] = [];
    const passwordHash =
      body.createType === 'direct' && body.password
        ? await bcrypt.hash(body.password, 10)
        : undefined;

    for (const user of body.users) {
      const identifier = user.email || user.phone;
      try {
        // Check if user already exists
        const existingUser = await findUserByEmailOrPhone(user.phone.trim());
        if (existingUser && existingUser.organizationId === organizationId) {
          results.push({
            identifier,
            success: false,
            error: 'User with this phone number already exists',
          });
          continue;
        }

        if (user.email) {
          const existingByEmail = await findUserByEmailOrPhone(user.email.trim());
          if (existingByEmail) {
            results.push({
              identifier,
              success: false,
              error: 'User with this email already exists',
            });
            continue;
          }
        }

        let createdUser;
        if (body.createType === 'direct' && passwordHash) {
          // Direct creation
          createdUser = await createUser({
            organizationId,
            phone: user.phone.trim(),
            email: user.email?.trim() || null,
            passwordHash,
            roles: user.roles,
            status: 'active',
          });

          // Update name if provided
          if (user.name && user.name.trim()) {
            const { updateUser } = await import('@/lib/auth/users');
            await updateUser(createdUser._id.toString(), { name: user.name.trim() }, false);
          }
        } else {
          // Invitation
          const result = await createInvitation({
            organizationId,
            email: user.email || null,
            phone: user.phone,
            roles: user.roles,
            invitedBy: context.userId,
            name: user.name || null,
          });
          createdUser = result.user;
        }

        // Log user creation/invitation
        await logActivitySafe({
          userId: createdUser._id.toString(),
          organizationId: createdUser.organizationId,
          action: body.createType === 'direct' ? 'user_created' : 'user_invited',
          details: {
            createdBy: context.userId,
            roles: user.roles,
            email: user.email || null,
            phone: user.phone,
            bulkOperation: true,
          },
          request,
        });

        results.push({
          userId: createdUser._id.toString(),
          identifier,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to process user ${identifier}:`, error);
        results.push({
          identifier,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: body.users.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('Bulk invite error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to process bulk invite' }, { status: 500 });
  }
}

