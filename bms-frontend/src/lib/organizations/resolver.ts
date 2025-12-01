import type { AuthContext } from '@/lib/auth/authz';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { findOrganizationById } from './organizations';

export interface OrganizationContext {
  organizationId: string;
  organization: {
    _id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * Resolves organization context from the current session.
 * Returns the organizationId from the auth context and optionally loads the organization document.
 */
export async function resolveOrganizationFromSession(
  loadOrganization = false,
): Promise<OrganizationContext | null> {
  const authContext = await getAuthContextFromCookies();

  if (!authContext || !authContext.organizationId) {
    return null;
  }

  const organizationId = authContext.organizationId;

  if (!loadOrganization) {
    return {
      organizationId,
      organization: null,
    };
  }

  const organization = await findOrganizationById(organizationId);
  if (!organization) {
    return {
      organizationId,
      organization: null,
    };
  }

  return {
    organizationId,
    organization: {
      _id: organization._id,
      name: organization.name,
      code: organization.code,
    },
  };
}

/**
 * Requires organization context from session.
 * Throws an error if no organization is found.
 */
export async function requireOrganizationFromSession(
  loadOrganization = false,
): Promise<OrganizationContext> {
  const context = await resolveOrganizationFromSession(loadOrganization);

  if (!context) {
    throw new Error('Organization context is required but not found in session');
  }

  return context;
}

/**
 * Gets organizationId from auth context.
 * Returns null if not available.
 */
export function getOrganizationIdFromContext(
  context: AuthContext | null | undefined,
): string | null {
  if (!context || !context.organizationId) {
    return null;
  }

  return context.organizationId;
}
