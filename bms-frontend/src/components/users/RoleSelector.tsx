'use client';

import { Checkbox } from '@/lib/components/ui/checkbox';
import { Label } from '@/lib/components/ui/label';
import { Card, CardContent } from '@/lib/components/ui/card';
import type { UserRole } from '@/lib/auth/types';
import { PermissionPreview } from './PermissionPreview';

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

interface RoleSelectorProps {
  selectedRoles: UserRole[];
  onRolesChange: (roles: UserRole[]) => void;
  allowedRoles?: UserRole[] | undefined; // Roles that can be selected (for ORG_ADMIN restrictions)
  showPermissionPreview?: boolean;
}

export function RoleSelector({
  selectedRoles,
  onRolesChange,
  allowedRoles,
  showPermissionPreview = true,
}: RoleSelectorProps) {
  const handleRoleToggle = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter((r) => r !== role));
    } else {
      onRolesChange([...selectedRoles, role]);
    }
  };

  // Determine which roles to show
  const rolesToShow = allowedRoles
    ? (Object.keys(ROLE_DESCRIPTIONS) as UserRole[]).filter((role) => allowedRoles.includes(role))
    : (Object.keys(ROLE_DESCRIPTIONS) as UserRole[]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold mb-3 block">Select Roles</Label>
        <div className="space-y-3 border rounded-lg p-4">
          {rolesToShow.map((role) => {
            const isSelected = selectedRoles.includes(role);
            const isDisabled = allowedRoles && !allowedRoles.includes(role);

            return (
              <div key={role} className="flex items-start space-x-3">
                <Checkbox
                  id={role}
                  checked={isSelected}
                  disabled={isDisabled}
                  onCheckedChange={() => !isDisabled && handleRoleToggle(role)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor={role}
                    className={`text-sm font-medium leading-none cursor-pointer ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {role.replace(/_/g, ' ')}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              </div>
            );
          })}
        </div>
        {selectedRoles.length === 0 && (
          <p className="text-sm text-destructive mt-2">At least one role is required</p>
        )}
      </div>

      {showPermissionPreview && selectedRoles.length > 0 && (
        <PermissionPreview roles={selectedRoles} />
      )}
    </div>
  );
}
