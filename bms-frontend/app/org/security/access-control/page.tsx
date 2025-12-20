'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Shield, Plus, Filter } from 'lucide-react';

interface AccessPermission {
  id: string;
  organizationId: string;
  buildingId: string;
  entityType: 'tenant' | 'visitor' | 'staff';
  entityId: string;
  accessLevel: 'full' | 'restricted' | 'denied';
  restrictions?: {
    timeWindows?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }> | null;
    areas?: string[] | null;
    requiresEscort?: boolean | null;
  } | null;
  validFrom?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  createdAt: string;
}

export default function AccessControlPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [filteredPermissions, setFilteredPermissions] = useState<AccessPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [accessLevelFilter, setAccessLevelFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchPermissions() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ permissions: AccessPermission[] }>(
          '/api/security/access-control',
        );
        setPermissions(data.permissions || []);
        setFilteredPermissions(data.permissions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load access permissions');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPermissions();
  }, []);

  useEffect(() => {
    let filtered = permissions;

    if (entityTypeFilter !== 'all') {
      filtered = filtered.filter((p) => p.entityType === entityTypeFilter);
    }

    if (accessLevelFilter !== 'all') {
      filtered = filtered.filter((p) => p.accessLevel === accessLevelFilter);
    }

    setFilteredPermissions(filtered);
  }, [entityTypeFilter, accessLevelFilter, permissions]);

  function getAccessLevelBadgeVariant(level: string) {
    switch (level) {
      case 'full':
        return 'default';
      case 'restricted':
        return 'secondary';
      case 'denied':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  function isPermissionValid(permission: AccessPermission): boolean {
    const now = new Date();
    if (permission.validFrom && now < new Date(permission.validFrom)) return false;
    if (permission.validUntil && now > new Date(permission.validUntil)) return false;
    return true;
  }

  return (
    <DashboardPage
      title="Access Control"
      description="Manage access permissions for tenants, visitors, and staff"
      icon={<Shield className="h-5 w-5" />}
    >
      <div className="col-span-full flex justify-between items-center">
        <div className="flex gap-2">
          <Link href="/org/security/access-control/tenants">
            <Button variant="outline">Manage Tenant Access</Button>
          </Link>
          <Link href="/org/security/access-control/visitors">
            <Button variant="outline">Manage Visitor Access</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
            <SelectItem value="visitor">Visitor</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accessLevelFilter} onValueChange={setAccessLevelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by access level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="full">Full</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid From</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading permissions...</p>
                </TableCell>
              </TableRow>
            ) : filteredPermissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {permissions.length === 0
                      ? 'No access permissions found.'
                      : 'No permissions match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredPermissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <Badge variant="outline">{permission.entityType}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {permission.entityId.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getAccessLevelBadgeVariant(permission.accessLevel)}>
                      {permission.accessLevel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isPermissionValid(permission) ? 'default' : 'secondary'}>
                      {isPermissionValid(permission) ? 'Active' : 'Expired'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {permission.validFrom
                      ? new Date(permission.validFrom).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {permission.validUntil
                      ? new Date(permission.validUntil).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/org/security/access-control/${permission.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}

