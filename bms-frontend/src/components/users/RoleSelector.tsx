'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Label } from '@/lib/components/ui/label';
import { Badge } from '@/lib/components/ui/badge';
import { Info } from 'lucide-react';
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

const STAFF_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BUILDING_MANAGER',
  'FACILITY_MANAGER',
  'ACCOUNTANT',
  'SECURITY',
  'TECHNICIAN',
  'AUDITOR',
];

const TENANT_ROLE: UserRole = 'TENANT';

interface RoleSelectorProps {
  currentRoles: UserRole[];
  onRolesChange: (roles: UserRole[]) => void;
  disabled?: boolean;
  currentUserRoles?: UserRole[];
  isSuperAdmin?: boolean;
  showDescriptions?: boolean;
  className?: string;
}

export function RoleSelector({
  currentRoles,
  onRolesChange,
  disabled = false,
  currentUserRoles = [],
  isSuperAdmin = false,
  showDescriptions = true,
  className,
}: RoleSelectorProps) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(currentRoles);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRoles(currentRoles);
  }, [currentRoles]);

  // Determine which roles the current user can assign
  const canAssignRole = (role: UserRole): boolean => {
    if (disabled) return false;
    if (isSuperAdmin) return true;

    // Only ORG_ADMIN and SUPER_ADMIN can assign roles
    const canAssign =
      currentUserRoles.includes('ORG_ADMIN') || currentUserRoles.includes('SUPER_ADMIN');
    if (!canAssign) return false;

    // ORG_ADMIN cannot assign SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && !isSuperAdmin) {
      return false;
    }

    return true;
  };

  const handleRoleToggle = (role: UserRole) => {
    if (!canAssignRole(role)) return;

    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];

    // Validate role combinations
    const validation = validateRoleCombination(newRoles);
    if (!validation.valid) {
      setValidationError(validation.error || null);
      return;
    }

    setValidationError(null);
    setSelectedRoles(newRoles);
    onRolesChange(newRoles);
  };

  const validateRoleCombination = (roles: UserRole[]): { valid: boolean; error?: string } => {
    if (roles.length === 0) {
      return { valid: false, error: 'At least one role is required' };
    }

    // Check if TENANT is combined with staff roles
    const hasTenant = roles.includes(TENANT_ROLE);
    const hasStaffRole = roles.some((role) => STAFF_ROLES.includes(role));

    if (hasTenant && hasStaffRole) {
      return {
        valid: false,
        error:
          'TENANT role cannot be combined with staff roles. A user must be either a tenant or staff member, not both.',
      };
    }

    // Check if SUPER_ADMIN is combined with other roles (optional: SUPER_ADMIN should typically be standalone)
    // This is a warning, not an error - we'll allow it but show a message
    if (roles.includes('SUPER_ADMIN') && roles.length > 1) {
      // This is allowed but unusual
    }

    return { valid: true };
  };

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

  return (
    <div className={className}>
      <div className="space-y-3">
        {allRoles.map((role) => {
          const isSelected = selectedRoles.includes(role);
          const canAssign = canAssignRole(role);
          const isDisabled = disabled || !canAssign;

          return (
            <div
              key={role}
              className={`flex items-start space-x-3 p-3 rounded-lg border ${
                isSelected ? 'bg-primary/5 border-primary' : 'bg-background border-border'
              } ${isDisabled ? 'opacity-50' : ''}`}
            >
              <Checkbox
                id={role}
                checked={isSelected}
                onCheckedChange={() => handleRoleToggle(role)}
                disabled={isDisabled}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={role}
                    className={`text-sm font-medium leading-none cursor-pointer ${
                      isDisabled ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  >
                    {role.replace(/_/g, ' ')}
                  </label>
                  {isSelected && (
                    <Badge variant="outline" className="text-xs">
                      Selected
                    </Badge>
                  )}
                  {!canAssign && !isSuperAdmin && role === 'SUPER_ADMIN' && (
                    <Badge variant="secondary" className="text-xs">
                      Requires SUPER_ADMIN
                    </Badge>
                  )}
                </div>
                {showDescriptions && (
                  <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTIONS[role]}</p>
                )}
                {!canAssign && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    You don&apos;t have permission to assign this role
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {validationError && (
        <div className="mt-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{validationError}</p>
        </div>
      )}

      {selectedRoles.length > 0 && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <Label className="text-sm font-medium">Selected Roles ({selectedRoles.length})</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedRoles.map((role) => (
              <Badge key={role} variant="default">
                {role.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
