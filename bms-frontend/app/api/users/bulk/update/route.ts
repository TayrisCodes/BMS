import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { findUserById, updateUserRoles, updateUserStatus, updateUser } from '@/lib/auth/users';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import type { UserRole, UserStatus } from '@/lib/auth/types';

const MAX_BATCH_SIZE = 50;

interface BulkUpdateResult {
  userId: string;
  success: boolean;
  error?: string;
}

/**
 * POST /api/users/bulk/update
 * Bulk update user status or roles (up to 50 per batch).
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to update users
    requirePermission(context, 'users', 'update');

    const body = (await request.json()) as {
      userIds: string[];
      updates: {
        status?: UserStatus;
        roles?: UserRole[];
      };
    };

    // Validate batch size
    if (!body.userIds || !Array.isArray(body.userIds)) {
      return NextResponse.json({ error: 'userIds array is required' }, { status: 400 });
    }

    if (body.userIds.length === 0) {
      return NextResponse.json({ error: 'At least one user ID is required' }, { status: 400 });
    }

    if (body.userIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} users per batch` },
        { status: 400 },
      );
    }

    if (!body.updates || Object.keys(body.updates).length === 0) {
      return NextResponse.json({ error: 'At least one update field is required' }, { status: 400 });
    }

    // Validate role restrictions for ORG_ADMIN
    if (body.updates.roles && !isSuperAdmin(context)) {
      const restrictedRoles: UserRole[] = ['ORG_ADMIN', 'SUPER_ADMIN', 'TENANT'];
      const hasRestrictedRole = body.updates.roles.some((role) => restrictedRoles.includes(role));

      if (hasRestrictedRole) {
        return NextResponse.json(
          {
            error:
              'You cannot assign ORG_ADMIN, SUPER_ADMIN, or TENANT roles. TENANT accounts must be created through the tenants page.',
          },
          { status: 403 },
        );
      }
    }

    // Process updates
    const results: BulkUpdateResult[] = [];

    for (const userId of body.userIds) {
      try {
        // Get existing user
        const user = await findUserById(userId);
        if (!user) {
          results.push({
            userId,
            success: false,
            error: 'User not found',
          });
          continue;
        }

        // Verify user belongs to same org (unless SUPER_ADMIN)
        if (!isSuperAdmin(context)) {
          try {
            validateOrganizationAccess(context, user.organizationId);
          } catch {
            results.push({
              userId,
              success: false,
              error: 'User does not belong to your organization',
            });
            continue;
          }

          // ORG_ADMIN cannot edit other ORG_ADMIN or SUPER_ADMIN users
          const hasRestrictedRole =
            user.roles.includes('ORG_ADMIN') || user.roles.includes('SUPER_ADMIN');
          if (hasRestrictedRole) {
            results.push({
              userId,
              success: false,
              error: 'Cannot update users with ORG_ADMIN or SUPER_ADMIN roles',
            });
            continue;
          }
        }

        // Update roles if provided
        if (body.updates.roles) {
          const result = await updateUserRoles(userId, body.updates.roles);
          if (!result) {
            results.push({
              userId,
              success: false,
              error: 'Failed to update roles',
            });
            continue;
          }

          // Log role update
          await logActivitySafe({
            userId,
            organizationId: user.organizationId,
            action: 'role_assigned',
            details: {
              updatedBy: context.userId,
              newRoles: body.updates.roles,
              bulkOperation: true,
            },
            request,
          });
        }

        // Update status if provided
        if (body.updates.status) {
          const result = await updateUserStatus(userId, body.updates.status);
          if (!result) {
            results.push({
              userId,
              success: false,
              error: 'Failed to update status',
            });
            continue;
          }

          // Log status update
          await logActivitySafe({
            userId,
            organizationId: user.organizationId,
            action: 'status_changed',
            details: {
              updatedBy: context.userId,
              newStatus: body.updates.status,
              bulkOperation: true,
            },
            request,
          });
        }

        results.push({
          userId,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to update user ${userId}:`, error);
        results.push({
          userId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: body.userIds.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to process bulk update' }, { status: 500 });
  }
}

