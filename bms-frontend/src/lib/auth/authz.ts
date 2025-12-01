import type { UserRole } from './types';
import { hasAnyRolePermission } from './permissions';

export interface AuthContext {
  userId: string;
  organizationId?: string;
  roles: UserRole[];
  buildingId?: string; // Optional building-level scoping for future use
  tenantId?: string; // Optional tenant ID for users with TENANT role
}

export function isSuperAdmin(context: AuthContext | null | undefined): boolean {
  if (!context) return false;
  return context.roles.includes('SUPER_ADMIN');
}

export function hasOrgRole(
  context: AuthContext | null | undefined,
  allowedRoles: UserRole[],
): boolean {
  if (!context) return false;

  if (isSuperAdmin(context)) {
    return true;
  }

  return context.roles.some((role) => allowedRoles.includes(role));
}

/**
 * Checks if the user has a specific permission.
 * SUPER_ADMIN has all permissions.
 */
export function hasPermission(
  context: AuthContext | null | undefined,
  module: Parameters<typeof hasAnyRolePermission>[1],
  action: string,
): boolean {
  if (!context) return false;

  if (isSuperAdmin(context)) {
    return true;
  }

  return hasAnyRolePermission(context.roles, module, action);
}

/**
 * Requires that the user has a specific role.
 * Throws an error if the requirement is not met.
 */
export function requireRole(
  context: AuthContext | null | undefined,
  allowedRoles: UserRole[],
): void {
  if (!context) {
    throw new Error('Authentication required');
  }

  if (!hasOrgRole(context, allowedRoles)) {
    throw new Error(`Access denied: requires one of ${allowedRoles.join(', ')}`);
  }
}

/**
 * Requires that the user has a specific permission.
 * Throws an error if the requirement is not met.
 */
export function requirePermission(
  context: AuthContext | null | undefined,
  module: Parameters<typeof hasAnyRolePermission>[1],
  action: string,
): void {
  if (!context) {
    throw new Error('Authentication required');
  }

  if (!hasPermission(context, module, action)) {
    throw new Error(`Access denied: requires ${module}.${action} permission`);
  }
}
