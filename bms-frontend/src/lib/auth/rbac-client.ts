'use client';

/**
 * Client-side RBAC helpers for UI components.
 * These functions check permissions based on user roles fetched from the API.
 */

import type { UserRole } from './types';
import { hasAnyRolePermission } from './permissions';

export interface ClientUserInfo {
  roles: UserRole[];
  organizationId?: string;
}

/**
 * Checks if user has a specific role (client-side).
 */
export function hasRole(userInfo: ClientUserInfo | null, allowedRoles: UserRole[]): boolean {
  if (!userInfo) return false;
  return userInfo.roles.some((role) => allowedRoles.includes(role));
}

/**
 * Checks if user is SUPER_ADMIN (client-side).
 */
export function isSuperAdmin(userInfo: ClientUserInfo | null): boolean {
  if (!userInfo) return false;
  return userInfo.roles.includes('SUPER_ADMIN');
}

/**
 * Checks if user has a specific permission (client-side).
 * SUPER_ADMIN has all permissions.
 */
export function hasPermission(
  userInfo: ClientUserInfo | null,
  module: Parameters<typeof hasAnyRolePermission>[1],
  action: string,
): boolean {
  if (!userInfo) return false;

  if (isSuperAdmin(userInfo)) {
    return true;
  }

  return hasAnyRolePermission(userInfo.roles, module, action);
}

/**
 * Hook-like function to get user info from /api/me.
 * Use this in client components to check permissions.
 */
export async function getUserInfo(): Promise<ClientUserInfo | null> {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      auth?: { roles: UserRole[]; organizationId?: string };
    };

    if (!data.auth) {
      return null;
    }

    const { roles, organizationId } = data.auth;

    // Only include organizationId when it is available to satisfy exactOptionalPropertyTypes
    return organizationId ? { roles, organizationId } : { roles };
  } catch {
    return null;
  }
}
