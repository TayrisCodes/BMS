import { findUserById, updateUserStatus, getUsersCollection } from '@/lib/auth/users';
import type { User, UserStatus } from '@/lib/auth/types';
import type { Document } from 'mongodb';

export interface StatusChangeResult {
  success: boolean;
  user: User | null;
  error?: string;
}

export interface SuspendUserOptions {
  reason?: string;
  suspendedBy?: string; // User ID who suspended
}

/**
 * Activate a user account.
 * Sets status to "active" and clears any suspension-related data.
 * Validates that user exists and is not already active.
 */
export async function activateUser(userId: string): Promise<StatusChangeResult> {
  try {
    const user = await findUserById(userId);
    if (!user) {
      return {
        success: false,
        user: null,
        error: 'User not found',
      };
    }

    if (user.status === 'active') {
      return {
        success: false,
        user: null,
        error: 'User is already active',
      };
    }

    const updatedUser = await updateUserStatus(userId, 'active');

    if (!updatedUser) {
      return {
        success: false,
        user: null,
        error: 'Failed to activate user',
      };
    }

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Failed to activate user',
    };
  }
}

/**
 * Deactivate a user account.
 * Sets status to "inactive" (soft delete).
 * Prevents deactivating the last ORG_ADMIN in an organization.
 * Prevents deactivating SUPER_ADMIN.
 */
export async function deactivateUser(userId: string): Promise<StatusChangeResult> {
  try {
    const user = await findUserById(userId);
    if (!user) {
      return {
        success: false,
        user: null,
        error: 'User not found',
      };
    }

    // Prevent deactivating SUPER_ADMIN
    if (user.roles?.includes('SUPER_ADMIN')) {
      return {
        success: false,
        user: null,
        error: 'Cannot deactivate SUPER_ADMIN user',
      };
    }

    // Prevent deactivating last ORG_ADMIN in organization
    if (user.roles?.includes('ORG_ADMIN') && user.organizationId) {
      const collection = await getUsersCollection();
      const orgAdmins = await collection.countDocuments({
        organizationId: user.organizationId,
        roles: 'ORG_ADMIN',
        status: { $ne: 'inactive' },
        _id: { $ne: user._id },
      } as Document);

      if (orgAdmins === 0) {
        return {
          success: false,
          user: null,
          error: 'Cannot deactivate last ORG_ADMIN in organization',
        };
      }
    }

    if (user.status === 'inactive') {
      return {
        success: false,
        user: null,
        error: 'User is already inactive',
      };
    }

    const updatedUser = await updateUserStatus(userId, 'inactive');

    if (!updatedUser) {
      return {
        success: false,
        user: null,
        error: 'Failed to deactivate user',
      };
    }

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Failed to deactivate user',
    };
  }
}

/**
 * Suspend a user account.
 * Sets status to "suspended" and optionally stores suspension reason.
 * Prevents suspending the last ORG_ADMIN in an organization.
 * Prevents suspending SUPER_ADMIN.
 */
export async function suspendUser(
  userId: string,
  options?: SuspendUserOptions,
): Promise<StatusChangeResult> {
  try {
    const user = await findUserById(userId);
    if (!user) {
      return {
        success: false,
        user: null,
        error: 'User not found',
      };
    }

    // Prevent suspending SUPER_ADMIN
    if (user.roles?.includes('SUPER_ADMIN')) {
      return {
        success: false,
        user: null,
        error: 'Cannot suspend SUPER_ADMIN user',
      };
    }

    // Prevent suspending last ORG_ADMIN in organization
    if (user.roles?.includes('ORG_ADMIN') && user.organizationId) {
      const collection = await getUsersCollection();
      const orgAdmins = await collection.countDocuments({
        organizationId: user.organizationId,
        roles: 'ORG_ADMIN',
        status: { $nin: ['inactive', 'suspended'] },
        _id: { $ne: user._id },
      } as Document);

      if (orgAdmins === 0) {
        return {
          success: false,
          user: null,
          error: 'Cannot suspend last ORG_ADMIN in organization',
        };
      }
    }

    if (user.status === 'suspended') {
      return {
        success: false,
        user: null,
        error: 'User is already suspended',
      };
    }

    // Update status to suspended
    const updatedUser = await updateUserStatus(userId, 'suspended');

    if (!updatedUser) {
      return {
        success: false,
        user: null,
        error: 'Failed to suspend user',
      };
    }

    // Optionally store suspension reason and metadata
    // Note: This would require adding a suspensionReason field to the User model
    // For now, we'll just update the status
    // In the future, you could add:
    // - suspensionReason: string | null
    // - suspendedAt: Date | null
    // - suspendedBy: string | null

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Failed to suspend user',
    };
  }
}

/**
 * Unsuspend a user account.
 * Reactivates a suspended user by setting status to "active".
 * Validates that user exists and is currently suspended.
 */
export async function unsuspendUser(userId: string): Promise<StatusChangeResult> {
  try {
    const user = await findUserById(userId);
    if (!user) {
      return {
        success: false,
        user: null,
        error: 'User not found',
      };
    }

    if (user.status !== 'suspended') {
      return {
        success: false,
        user: null,
        error: `User is not suspended. Current status: ${user.status}`,
      };
    }

    const updatedUser = await updateUserStatus(userId, 'active');

    if (!updatedUser) {
      return {
        success: false,
        user: null,
        error: 'Failed to unsuspend user',
      };
    }

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Failed to unsuspend user',
    };
  }
}

/**
 * Get status change history for a user (future enhancement).
 * This would require an audit log collection.
 */
export async function getStatusHistory(userId: string): Promise<unknown[]> {
  // TODO: Implement when audit logging is added
  return [];
}
