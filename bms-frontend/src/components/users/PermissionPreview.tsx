'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { Check, X } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';

interface PermissionPreviewProps {
  roles: UserRole[];
}

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
  settings: 'Settings',
};

export function PermissionPreview({ roles }: PermissionPreviewProps) {
  if (roles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Permission Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select at least one role to see permissions
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get all unique permissions across selected roles
  const allPermissions: Record<string, Set<string>> = {};

  roles.forEach((role) => {
    const rolePermissions = PERMISSIONS[role];
    if (rolePermissions) {
      Object.entries(rolePermissions).forEach(([module, actions]) => {
        if (!allPermissions[module]) {
          allPermissions[module] = new Set();
        }
        actions.forEach((action) => allPermissions[module].add(action));
      });
    }
  });

  // Check if user has SUPER_ADMIN (all permissions)
  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Preview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Permissions for: {roles.map((r) => r.replace(/_/g, ' ')).join(', ')}
        </p>
      </CardHeader>
      <CardContent>
        {isSuperAdmin ? (
          <div className="space-y-2">
            <Badge variant="default" className="w-full justify-center py-2">
              <Check className="h-4 w-4 mr-2" />
              SUPER_ADMIN has all permissions across all modules
            </Badge>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(allPermissions)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([module, actions]) => (
                <div key={module} className="border rounded-lg p-3">
                  <h4 className="font-semibold text-sm mb-2">{MODULE_NAMES[module] || module}</h4>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(actions)
                      .sort()
                      .map((action) => (
                        <Badge key={action} variant="outline" className="text-xs">
                          {action.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
