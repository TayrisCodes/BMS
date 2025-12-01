import type { UserRole } from './types';

/**
 * Permission matrix defining allowed actions per role.
 * Actions are organized by module/domain area.
 */
export const PERMISSIONS: Record<
  UserRole,
  {
    organizations: string[];
    buildings: string[];
    units: string[];
    tenants: string[];
    leases: string[];
    invoices: string[];
    payments: string[];
    complaints: string[];
    maintenance: string[];
    assets: string[];
    utilities: string[];
    security: string[];
    parking: string[];
    reporting: string[];
    users: string[];
  }
> = {
  SUPER_ADMIN: {
    organizations: ['create', 'read', 'update', 'deactivate', 'list_all'],
    buildings: ['read_all', 'list_all'],
    units: ['read_all', 'list_all'],
    tenants: ['read_all', 'list_all'],
    leases: ['read_all', 'list_all'],
    invoices: ['read_all', 'list_all'],
    payments: ['read_all', 'list_all'],
    complaints: ['read_all', 'list_all'],
    maintenance: ['read_all', 'list_all'],
    assets: ['read_all', 'list_all'],
    utilities: ['read_all', 'list_all'],
    security: ['read_all', 'list_all'],
    parking: ['read_all', 'list_all'],
    reporting: ['view_cross_org', 'system_health', 'all_metrics'],
    users: ['create_org_admin', 'read_all', 'list_all'],
  },
  ORG_ADMIN: {
    organizations: ['read', 'update'],
    buildings: ['create', 'read', 'update', 'delete', 'list'],
    units: ['create', 'read', 'update', 'delete', 'list'],
    tenants: ['create', 'read', 'update', 'delete', 'list'],
    leases: ['create', 'read', 'update', 'delete', 'list', 'terminate'],
    invoices: ['create', 'read', 'update', 'delete', 'list', 'send'],
    payments: ['read', 'list', 'record', 'reconcile'],
    complaints: ['read', 'update', 'assign', 'resolve', 'list'],
    maintenance: ['read', 'create', 'update', 'assign', 'list'],
    assets: ['create', 'read', 'update', 'delete', 'list'],
    utilities: ['read', 'update', 'list'],
    security: ['read', 'update', 'list'],
    parking: ['create', 'read', 'update', 'delete', 'list', 'assign'],
    reporting: ['view_org', 'export'],
    users: ['create', 'read', 'update', 'delete', 'list', 'assign_roles'],
  },
  BUILDING_MANAGER: {
    organizations: ['read'],
    buildings: ['read', 'update'],
    units: ['read', 'update', 'list'],
    tenants: ['read', 'update', 'list'],
    leases: ['read', 'update', 'list'],
    invoices: ['read', 'create', 'update', 'list'],
    payments: ['read', 'list', 'record'],
    complaints: ['read', 'update', 'assign', 'resolve', 'list'],
    maintenance: ['read', 'create', 'update', 'assign', 'list'],
    assets: ['read', 'update', 'list'],
    utilities: ['read', 'update', 'list'],
    security: ['read', 'update', 'list'],
    parking: ['read', 'update', 'list', 'assign'],
    reporting: ['view_building'],
    users: ['read', 'list'],
  },
  FACILITY_MANAGER: {
    organizations: ['read'],
    buildings: ['read'],
    units: ['read', 'list'],
    tenants: ['read', 'list'],
    leases: ['read', 'list'],
    invoices: ['read', 'list'],
    payments: ['read', 'list'],
    complaints: ['read', 'update', 'resolve', 'list'],
    maintenance: ['read', 'create', 'update', 'assign', 'list', 'schedule'],
    assets: ['read', 'update', 'list'],
    utilities: ['read', 'update', 'list'],
    security: ['read', 'list'],
    parking: ['read', 'list'],
    reporting: ['view_facility'],
    users: ['read', 'list'],
  },
  ACCOUNTANT: {
    organizations: ['read'],
    buildings: ['read'],
    units: ['read', 'list'],
    tenants: ['read', 'list'],
    leases: ['read', 'list'],
    invoices: ['read', 'create', 'update', 'delete', 'list', 'send'],
    payments: ['read', 'create', 'update', 'list', 'reconcile', 'export'],
    complaints: ['read', 'list'],
    maintenance: ['read', 'list'],
    assets: ['read', 'list'],
    utilities: ['read', 'list'],
    security: ['read'],
    parking: ['read'],
    reporting: ['view_financial', 'export'],
    users: ['read', 'list'],
  },
  SECURITY: {
    organizations: ['read'],
    buildings: ['read'],
    units: ['read', 'list'],
    tenants: ['read', 'list'],
    leases: ['read'],
    invoices: ['read'],
    payments: ['read'],
    complaints: ['read', 'create', 'list'],
    maintenance: ['read', 'list'],
    assets: ['read'],
    utilities: ['read'],
    security: ['read', 'create', 'update', 'list', 'log_entry', 'log_exit'],
    parking: ['read', 'update', 'list'],
    reporting: ['view_security'],
    users: ['read'],
  },
  TECHNICIAN: {
    organizations: ['read'],
    buildings: ['read'],
    units: ['read', 'list'],
    tenants: ['read', 'list'],
    leases: ['read'],
    invoices: ['read'],
    payments: ['read'],
    complaints: ['read', 'update', 'list'],
    maintenance: ['read', 'update', 'list', 'complete', 'log_work'],
    assets: ['read', 'update', 'list'],
    utilities: ['read', 'update', 'list'],
    security: ['read'],
    parking: ['read'],
    reporting: ['view_work'],
    users: ['read'],
  },
  TENANT: {
    organizations: ['read'],
    buildings: ['read'],
    units: ['read'],
    tenants: ['read', 'update_own'],
    leases: ['read_own'],
    invoices: ['read_own', 'list_own'],
    payments: ['read_own', 'create_own', 'list_own'],
    complaints: ['read_own', 'create', 'update_own', 'list_own'],
    maintenance: ['read_own', 'create', 'list_own'],
    assets: ['read'],
    utilities: ['read_own'],
    security: ['read'],
    parking: ['read_own'],
    reporting: ['view_own'],
    users: [],
  },
  AUDITOR: {
    organizations: ['read'],
    buildings: ['read', 'list'],
    units: ['read', 'list'],
    tenants: ['read', 'list'],
    leases: ['read', 'list'],
    invoices: ['read', 'list'],
    payments: ['read', 'list'],
    complaints: ['read', 'list'],
    maintenance: ['read', 'list'],
    assets: ['read', 'list'],
    utilities: ['read', 'list'],
    security: ['read', 'list'],
    parking: ['read', 'list'],
    reporting: ['view_all', 'export'],
    users: ['read', 'list'],
  },
};

/**
 * Checks if a role has a specific permission.
 */
export function hasPermission(
  role: UserRole,
  module: keyof (typeof PERMISSIONS)[UserRole],
  action: string,
): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;

  const modulePermissions = rolePermissions[module];
  if (!modulePermissions) return false;

  return modulePermissions.includes(action);
}

/**
 * Checks if any of the provided roles has a specific permission.
 */
export function hasAnyRolePermission(
  roles: UserRole[],
  module: keyof (typeof PERMISSIONS)[UserRole],
  action: string,
): boolean {
  return roles.some((role) => hasPermission(role, module, action));
}

