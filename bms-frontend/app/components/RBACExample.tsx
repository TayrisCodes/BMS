'use client';

import { useEffect, useState } from 'react';
import { getUserInfo, hasPermission, hasRole, isSuperAdmin } from '@/lib/auth/rbac-client';
import type { ClientUserInfo } from '@/lib/auth/rbac-client';

/**
 * Example component demonstrating client-side RBAC checks.
 * This shows how to conditionally render UI elements based on user permissions.
 */
export default function RBACExample() {
  const [userInfo, setUserInfo] = useState<ClientUserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserInfo()
      .then((info) => {
        setUserInfo(info);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-sm text-slate-500">Loading permissions...</div>;
  }

  if (!userInfo) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Please log in to view permissions.
        </p>
      </div>
    );
  }

  // Permission checks
  const canCreateBuildings = hasPermission(userInfo, 'buildings', 'create');
  const canDeleteBuildings = hasPermission(userInfo, 'buildings', 'delete');
  const canManageInvoices = hasPermission(userInfo, 'invoices', 'create');
  const canViewReports = hasPermission(userInfo, 'reporting', 'view_org');
  const canManageUsers = hasPermission(userInfo, 'users', 'create');

  // Role checks
  const isAdmin = hasRole(userInfo, ['ORG_ADMIN']);
  const isManager = hasRole(userInfo, ['BUILDING_MANAGER', 'FACILITY_MANAGER']);
  const isSuper = isSuperAdmin(userInfo);

  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
          RBAC Example
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Your roles: <span className="font-mono">{userInfo.roles.join(', ')}</span>
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Permissions</h3>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            {canCreateBuildings ? (
              <span className="text-green-600 dark:text-green-400">✓</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">✗</span>
            )}
            <span>Create Buildings</span>
          </div>

          <div className="flex items-center gap-2">
            {canDeleteBuildings ? (
              <span className="text-green-600 dark:text-green-400">✓</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">✗</span>
            )}
            <span>Delete Buildings</span>
          </div>

          <div className="flex items-center gap-2">
            {canManageInvoices ? (
              <span className="text-green-600 dark:text-green-400">✓</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">✗</span>
            )}
            <span>Manage Invoices</span>
          </div>

          <div className="flex items-center gap-2">
            {canViewReports ? (
              <span className="text-green-600 dark:text-green-400">✓</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">✗</span>
            )}
            <span>View Reports</span>
          </div>

          <div className="flex items-center gap-2">
            {canManageUsers ? (
              <span className="text-green-600 dark:text-green-400">✓</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">✗</span>
            )}
            <span>Manage Users</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Actions</h3>

        <div className="flex flex-wrap gap-2">
          {canCreateBuildings && (
            <button className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600">
              Create Building
            </button>
          )}

          {canManageInvoices && (
            <button className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600">
              Create Invoice
            </button>
          )}

          {canManageUsers && (
            <button className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600">
              Manage Users
            </button>
          )}

          {canViewReports && (
            <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              View Reports
            </button>
          )}

          {isSuper && (
            <button className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
              Super Admin Panel
            </button>
          )}
        </div>
      </div>

      {!canCreateBuildings && !canManageInvoices && !canManageUsers && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You don&apos;t have permissions to perform any actions. Contact your administrator.
        </p>
      )}
    </div>
  );
}
