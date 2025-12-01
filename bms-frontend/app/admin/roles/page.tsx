'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Shield, Info } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import { PERMISSIONS } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Platform owner with full system access across all organizations',
  ORG_ADMIN: 'Organization administrator with full access to their organization',
  BUILDING_MANAGER: 'Manages a specific building: units, tenants, complaints, invoices',
  FACILITY_MANAGER: 'Manages maintenance, assets, and facility operations',
  ACCOUNTANT: 'Manages invoices, payments, and financial operations',
  SECURITY: 'Manages security, visitor logs, and parking operations',
  TECHNICIAN: 'Executes maintenance work orders and logs activities',
  TENANT: 'Tenant portal access (own data only)',
  AUDITOR: 'Read-only access for auditing and reporting',
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 1,
  ORG_ADMIN: 2,
  BUILDING_MANAGER: 3,
  FACILITY_MANAGER: 3,
  ACCOUNTANT: 3,
  SECURITY: 4,
  TECHNICIAN: 4,
  AUDITOR: 3,
  TENANT: 5,
};

const MODULE_NAMES: Record<string, string> = {
  organizations: 'Organizations',
  buildings: 'Buildings',
  units: 'Units',
  tenants: 'Tenants',
  leases: 'Leases',
  invoices: 'Invoices',
  payments: 'Payments',
  complaints: 'Complaints',
  maintenance: 'Maintenance',
  assets: 'Assets',
  utilities: 'Utilities',
  security: 'Security',
  parking: 'Parking',
  reporting: 'Reporting',
  users: 'Users',
};

const ACTION_DESCRIPTIONS: Record<string, string> = {
  create: 'Create new records',
  read: 'View records',
  read_all: 'View all records (cross-org)',
  read_own: 'View own records only',
  update: 'Modify records',
  update_own: 'Modify own records only',
  delete: 'Delete records',
  list: 'List records',
  list_all: 'List all records (cross-org)',
  list_own: 'List own records only',
  assign: 'Assign to others',
  assign_roles: 'Assign roles to users',
  resolve: 'Resolve issues',
  terminate: 'Terminate leases',
  send: 'Send invoices',
  record: 'Record payments',
  reconcile: 'Reconcile payments',
  schedule: 'Schedule maintenance',
  complete: 'Complete work orders',
  log_work: 'Log work activities',
  log_entry: 'Log visitor entry',
  log_exit: 'Log visitor exit',
  export: 'Export data',
  view_org: 'View organization reports',
  view_building: 'View building reports',
  view_facility: 'View facility reports',
  view_financial: 'View financial reports',
  view_security: 'View security reports',
  view_work: 'View work reports',
  view_own: 'View own reports',
  view_all: 'View all reports',
  view_cross_org: 'View cross-organization reports',
  system_health: 'View system health',
  all_metrics: 'View all metrics',
  deactivate: 'Deactivate organizations',
  create_org_admin: 'Create organization admins',
};

export default function RolesPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPermissions() {
      try {
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
      } catch (err) {
        console.error('Failed to check permissions:', err);
      } finally {
        setLoading(false);
      }
    }
    checkPermissions();
  }, []);

  const allRoles: UserRole[] = [
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'BUILDING_MANAGER',
    'FACILITY_MANAGER',
    'ACCOUNTANT',
    'SECURITY',
    'TECHNICIAN',
    'TENANT',
    'AUDITOR',
  ];

  const sortedRoles = [...allRoles].sort((a, b) => ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">View role descriptions and permission matrix</p>
        </div>
      </div>

      {/* Role Hierarchy Info (for SUPER_ADMIN) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Role Hierarchy
            </CardTitle>
            <CardDescription>
              Understanding the role hierarchy helps in managing access control effectively.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default">Level 1</Badge>
                <span className="text-sm">SUPER_ADMIN - Platform-wide access</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">Level 2</Badge>
                <span className="text-sm">ORG_ADMIN - Organization-wide access</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Level 3</Badge>
                <span className="text-sm">
                  BUILDING_MANAGER, FACILITY_MANAGER, ACCOUNTANT, AUDITOR - Domain-specific access
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Level 4</Badge>
                <span className="text-sm">SECURITY, TECHNICIAN - Operational access</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Level 5</Badge>
                <span className="text-sm">TENANT - Self-service access</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roles List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedRoles.map((role) => (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{role.replace(/_/g, ' ')}</span>
                <Badge variant={role === 'SUPER_ADMIN' ? 'default' : 'outline'}>
                  Level {ROLE_HIERARCHY[role]}
                </Badge>
              </CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS[role]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Key Permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(PERMISSIONS[role])
                    .filter(([_, actions]) => actions.length > 0)
                    .slice(0, 5)
                    .map(([module, actions]) => (
                      <Badge key={module} variant="secondary" className="text-xs">
                        {MODULE_NAMES[module]}: {actions.length} actions
                      </Badge>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Detailed view of permissions for each role across all modules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  {allRoles.map((role) => (
                    <TableHead key={role} className="text-center min-w-[120px]">
                      {role.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(MODULE_NAMES).map(([module, moduleName]) => (
                  <TableRow key={module}>
                    <TableCell className="font-medium">{moduleName}</TableCell>
                    {allRoles.map((role) => {
                      const permissions =
                        PERMISSIONS[role][module as keyof (typeof PERMISSIONS)[UserRole]] || [];
                      return (
                        <TableCell key={role} className="text-center">
                          {permissions.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="text-xs">
                                {permissions.length}{' '}
                                {permissions.length === 1 ? 'action' : 'actions'}
                              </Badge>
                              <details className="text-xs text-muted-foreground cursor-pointer">
                                <summary className="hover:text-foreground">View</summary>
                                <div className="mt-2 space-y-1 text-left">
                                  {permissions.map((action) => (
                                    <div key={action} className="text-xs">
                                      • {action}
                                      {ACTION_DESCRIPTIONS[action] && (
                                        <span className="text-muted-foreground ml-1">
                                          ({ACTION_DESCRIPTIONS[action]})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Future Enhancement Note */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">Future Enhancement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <strong>Building-Level Role Assignments:</strong> In future versions, roles can be
            assigned at the building level (e.g., BUILDING_MANAGER for a specific building only).
            This would require a <code className="bg-muted px-1 rounded">userRoles</code> collection
            with a <code className="bg-muted px-1 rounded">buildingId</code> field. For MVP, all
            roles are organization-level only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
