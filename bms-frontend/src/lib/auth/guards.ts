import { redirect } from 'next/navigation';
import { getAuthContextFromCookies } from './session';
import { hasOrgRole, isSuperAdmin, type AuthContext } from './authz';
import type { UserRole } from './types';

/**
 * Shared function to fetch current user/session.
 * Returns the auth context or null if not authenticated.
 */
export async function getCurrentSession(): Promise<AuthContext | null> {
  return getAuthContextFromCookies();
}

/**
 * Requires authentication. Redirects to login if not authenticated.
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getCurrentSession();

  if (!context) {
    redirect('/login');
  }

  return context;
}

/**
 * Requires specific role(s). Redirects to login if not authenticated or doesn't have role.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  redirectTo = '/login',
): Promise<AuthContext> {
  const context = await getCurrentSession();

  if (!context) {
    redirect(redirectTo);
  }

  if (!hasOrgRole(context, allowedRoles)) {
    redirect(redirectTo);
  }

  return context;
}

/**
 * Requires staff role (not TENANT). Redirects tenants to tenant dashboard.
 */
export async function requireStaff(): Promise<AuthContext> {
  const context = await getCurrentSession();

  if (!context) {
    redirect('/login');
  }

  // Tenants should not access staff areas
  if (context.roles.includes('TENANT')) {
    redirect('/tenant/dashboard');
  }

  // Check if user has at least one staff role
  const staffRoles: UserRole[] = [
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'BUILDING_MANAGER',
    'FACILITY_MANAGER',
    'ACCOUNTANT',
    'SECURITY',
    'TECHNICIAN',
    'AUDITOR',
  ];

  if (!context.roles.some((role) => staffRoles.includes(role))) {
    redirect('/login');
  }

  return context;
}

/**
 * Requires tenant role. Redirects to tenant login if not authenticated or not a tenant.
 */
export async function requireTenant(): Promise<AuthContext> {
  const context = await getCurrentSession();

  if (!context) {
    redirect('/tenant/login');
  }

  if (!context.roles.includes('TENANT')) {
    redirect('/tenant/login');
  }

  return context;
}

/**
 * Requires SUPER_ADMIN role. Redirects to login if not authenticated or not SUPER_ADMIN.
 */
export async function requireSuperAdmin(): Promise<AuthContext> {
  const context = await getCurrentSession();

  if (!context) {
    redirect('/login');
  }

  if (!isSuperAdmin(context)) {
    redirect('/login');
  }

  return context;
}

/**
 * Gets the current session without redirecting.
 * Useful for conditional rendering based on auth status.
 */
export async function getSessionOrNull(): Promise<AuthContext | null> {
  return getCurrentSession();
}

