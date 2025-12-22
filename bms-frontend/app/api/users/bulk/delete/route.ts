import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission, isSuperAdmin } from '@/lib/auth/authz';
import { findUserById, deleteUser } from '@/lib/auth/users';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { logActivitySafe } from '@/modules/users/activity-logger';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

const MAX_BATCH_SIZE = 50;

interface BulkDeleteResult {
  userId: string;
  success: boolean;
  error?: string;
}

/**
 * POST /api/users/bulk/delete
 * Bulk soft delete users (up to 50 per batch).
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require permission to delete users
    requirePermission(context, 'users', 'delete');

    const body = (await request.json()) as {
      userIds: string[];
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

    // Process deletions
    const results: BulkDeleteResult[] = [];

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

          // ORG_ADMIN cannot delete other ORG_ADMIN or SUPER_ADMIN users
          const hasRestrictedRole =
            user.roles.includes('ORG_ADMIN') || user.roles.includes('SUPER_ADMIN');
          if (hasRestrictedRole) {
            results.push({
              userId,
              success: false,
              error: 'Cannot delete users with ORG_ADMIN or SUPER_ADMIN roles',
            });
            continue;
          }

          // Prevent deletion of last ORG_ADMIN in organization
          if (user.roles.includes('ORG_ADMIN')) {
            const db = await getDb();
            const orgAdmins = await db.collection('users').countDocuments({
              organizationId: user.organizationId,
              roles: 'ORG_ADMIN',
              status: { $ne: 'inactive' },
              _id: { $ne: new ObjectId(userId) },
            });

            if (orgAdmins === 0) {
              results.push({
                userId,
                success: false,
                error: 'Cannot delete last ORG_ADMIN in organization',
              });
              continue;
            }
          }
        }

        // Soft delete user
        const deleted = await deleteUser(userId, isSuperAdmin(context));

        if (!deleted) {
          results.push({
            userId,
            success: false,
            error: 'Failed to delete user',
          });
          continue;
        }

        // Log user deletion
        await logActivitySafe({
          userId,
          organizationId: user.organizationId,
          action: 'user_deleted',
          details: {
            deletedBy: context.userId,
            roles: user.roles,
            bulkOperation: true,
          },
          request,
        });

        results.push({
          userId,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error);
        if (error instanceof Error) {
          if (error.message.includes('Cannot delete') || error.message.includes('last ORG_ADMIN')) {
            results.push({
              userId,
              success: false,
              error: error.message,
            });
            continue;
          }
        }
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
    console.error('Bulk delete error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Failed to process bulk delete' }, { status: 500 });
  }
}
