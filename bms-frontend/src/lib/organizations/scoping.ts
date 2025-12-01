import type { AuthContext } from '@/lib/auth/authz';
import { getOrganizationIdFromContext } from './resolver';

/**
 * Creates a MongoDB query filter that includes organizationId.
 * For SUPER_ADMIN, organizationId is optional (can query across orgs).
 * For other roles, organizationId is required.
 */
export function withOrganizationScope<T extends Record<string, unknown>>(
  context: AuthContext | null | undefined,
  baseQuery: T = {} as T,
): T & { organizationId: string } {
  const organizationId = getOrganizationIdFromContext(context);

  if (!organizationId) {
    throw new Error('Organization ID is required for this operation');
  }

  return {
    ...baseQuery,
    organizationId,
  } as T & { organizationId: string };
}

/**
 * Creates a MongoDB query filter that optionally includes organizationId.
 * SUPER_ADMIN can omit organizationId to query across all organizations.
 * Other roles must include organizationId.
 */
export function withOptionalOrganizationScope<T extends Record<string, unknown>>(
  context: AuthContext | null | undefined,
  baseQuery: T = {} as T,
  allowCrossOrg = false,
): T | (T & { organizationId: string }) {
  const organizationId = getOrganizationIdFromContext(context);

  // SUPER_ADMIN can query across orgs if explicitly allowed
  const isSuperAdmin = context?.roles.includes('SUPER_ADMIN') ?? false;
  if (isSuperAdmin && allowCrossOrg) {
    return baseQuery;
  }

  if (!organizationId) {
    throw new Error('Organization ID is required for this operation');
  }

  return {
    ...baseQuery,
    organizationId,
  } as T & { organizationId: string };
}

/**
 * Validates that a resource belongs to the user's organization.
 * Throws an error if validation fails.
 */
export function validateOrganizationAccess(
  context: AuthContext | null | undefined,
  resourceOrganizationId: string | null | undefined,
): void {
  const isSuperAdmin = context?.roles.includes('SUPER_ADMIN') ?? false;

  // SUPER_ADMIN can access any organization
  if (isSuperAdmin) {
    return;
  }

  const userOrganizationId = getOrganizationIdFromContext(context);

  if (!userOrganizationId) {
    throw new Error('Organization ID is required for this operation');
  }

  if (!resourceOrganizationId) {
    throw new Error('Resource does not have an organization ID');
  }

  if (resourceOrganizationId !== userOrganizationId) {
    throw new Error('Access denied: resource belongs to a different organization');
  }
}
