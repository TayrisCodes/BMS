'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Building2,
  Activity,
  BarChart3,
  Download,
  Upload,
  UserPlus,
} from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import type { UserRole, UserStatus } from '@/lib/auth/types';
import { BulkOperationsDialog } from '@/components/users/BulkOperationsDialog';
import { CSVImportDialog } from '@/components/users/CSVImportDialog';

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  roles: UserRole[];
  status: UserStatus;
  organizationId?: string;
  organizationName?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    invited: 0,
    suspended: 0,
  });
  const [canInvite, setCanInvite] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkOperationOpen, setBulkOperationOpen] = useState(false);
  const [bulkOperationType, setBulkOperationType] = useState<'invite' | 'update' | 'delete'>(
    'invite',
  );
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  useEffect(() => {
    async function checkPermissions() {
      try {
        const profile = await apiGet<{ roles: UserRole[]; id?: string }>('/api/users/me');
        const roles = profile.roles || [];
        const orgAdmin = roles.includes('ORG_ADMIN');
        const superAdmin = roles.includes('SUPER_ADMIN');
        setCanInvite(orgAdmin || superAdmin);
        setIsOrgAdmin(orgAdmin);
        setIsSuperAdmin(superAdmin);
        setCurrentUserId(profile.id || null);

        // Fetch organizations if SUPER_ADMIN
        if (superAdmin) {
          try {
            const orgsData = await apiGet<{
              organizations: Array<{ id: string; name: string }>;
            }>('/api/organizations?limit=1000');
            setOrganizations(orgsData.organizations || []);
          } catch (err) {
            console.error('Failed to fetch organizations:', err);
          }
        }
      } catch (err) {
        console.error('Failed to check permissions:', err);
      }
    }
    checkPermissions();
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // Use dedicated stats endpoint with breakdown for SUPER_ADMIN
      const url = isSuperAdmin
        ? '/api/users/stats?breakdown=organization&role=true'
        : '/api/users/stats';
      const data = await apiGet<{
        stats: {
          total: number;
          active: number;
          invited: number;
          inactive: number;
          suspended: number;
        };
        byOrganization?: Array<{
          organizationId: string;
          organizationName: string;
          stats: {
            total: number;
            active: number;
            invited: number;
            inactive: number;
            suspended: number;
          };
        }>;
        byRole?: Record<string, number>;
        trends?: { last30Days: number; last90Days: number };
      }>(url);

      setStats({
        total: data.stats.total || 0,
        active: data.stats.active || 0,
        invited: data.stats.invited || 0,
        suspended: data.stats.suspended || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [isSuperAdmin]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (roleFilter !== 'all') {
        params.append('role', roleFilter);
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      // Add organization filter for SUPER_ADMIN
      if (isSuperAdmin && organizationFilter !== 'all') {
        params.append('organizationId', organizationFilter);
      }

      const data = await apiGet<UsersResponse>(`/api/users?${params.toString()}`);
      setUsers(data.users || []);
      setPagination((prev) => data.pagination || prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [page, roleFilter, statusFilter, searchTerm, organizationFilter, isSuperAdmin]);

  // Fetch stats only once on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDelete(userId: string) {
    if (
      !confirm('Are you sure you want to delete this user? This will set their status to inactive.')
    ) {
      return;
    }

    try {
      await apiDelete(`/api/users/${userId}`);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage system users and permissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <>
              <Link href="/admin/users/activity">
                <Button variant="outline">
                  <Activity className="h-4 w-4 mr-2" />
                  Activity Logs
                </Button>
              </Link>
              <Link href="/admin/users/analytics">
                <Button variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </Link>
            </>
          )}
          {isOrgAdmin && (
            <>
              <Link href="/admin/users/monitoring">
                <Button variant="outline">
                  <Activity className="h-4 w-4 mr-2" />
                  Monitoring
                </Button>
              </Link>
              <Link href="/admin/users/onboarding">
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Onboarding
                </Button>
              </Link>
            </>
          )}
          {canInvite && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setBulkOperationType('invite');
                  setBulkOperationOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Bulk Invite
              </Button>
              <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const params = new URLSearchParams();
                  if (roleFilter !== 'all') params.append('role', roleFilter);
                  if (statusFilter !== 'all') params.append('status', statusFilter);
                  if (searchTerm) params.append('search', searchTerm);
                  if (isSuperAdmin && organizationFilter !== 'all') {
                    params.append('organizationId', organizationFilter);
                  }
                  window.open(`/api/users/export?${params.toString()}`, '_blank');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Link href="/admin/users/invite">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invited Users</CardTitle>
            <Mail className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.invited}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspended}</div>
          </CardContent>
        </Card>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      {/* Bulk Operations Bar */}
      {selectedUserIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkOperationType('update');
                setBulkOperationOpen(true);
              }}
            >
              Update Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkOperationType('delete');
                setBulkOperationOpen(true);
              }}
            >
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedUserIds(new Set())}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
            <SelectItem value="BUILDING_MANAGER">Building Manager</SelectItem>
            <SelectItem value="FACILITY_MANAGER">Facility Manager</SelectItem>
            <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
            <SelectItem value="SECURITY">Security</SelectItem>
            <SelectItem value="TECHNICIAN">Technician</SelectItem>
            <SelectItem value="TENANT">Tenant</SelectItem>
            <SelectItem value="AUDITOR">Auditor</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        {isSuperAdmin && (
          <Select
            value={organizationFilter}
            onValueChange={(value) => {
              setOrganizationFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </form>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {isOrgAdmin && (
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.size === users.length && users.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds(new Set(users.map((u) => u.id)));
                      } else {
                        setSelectedUserIds(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isOrgAdmin ? 9 : 8} className="text-center py-8">
                  <p className="text-muted-foreground">Loading users...</p>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOrgAdmin ? 9 : 8} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {error ? 'Failed to load users' : 'No users found. Invite your first user.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  {isOrgAdmin && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedUserIds);
                          if (e.target.checked) {
                            newSet.add(user.id);
                          } else {
                            newSet.delete(user.id);
                          }
                          setSelectedUserIds(newSet);
                        }}
                        className="rounded"
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {user.name || user.email || user.phone || 'N/A'}
                  </TableCell>
                  <TableCell>{user.email || 'N/A'}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="outline" className="text-xs">
                          {role.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.status === 'active'
                          ? 'default'
                          : user.status === 'inactive' || user.status === 'suspended'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {isSuperAdmin && user.organizationId ? (
                      <Link
                        href={`/admin/organizations/${user.organizationId}/admins`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Building2 className="h-3 w-3" />
                        {user.organizationName || 'N/A'}
                      </Link>
                    ) : (
                      user.organizationName || 'N/A'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {/* ORG_ADMIN cannot edit/delete other ORG_ADMIN or SUPER_ADMIN, but can edit their own account */}
                      {(() => {
                        const isOwnAccount = currentUserId === user.id;
                        const hasRestrictedRole =
                          user.roles.includes('ORG_ADMIN') || user.roles.includes('SUPER_ADMIN');
                        const canEdit =
                          isSuperAdmin ||
                          (isOrgAdmin && (isOwnAccount || !hasRestrictedRole)) ||
                          (!isOrgAdmin && !isSuperAdmin);
                        const canDelete =
                          isSuperAdmin || (isOrgAdmin && !hasRestrictedRole && !isOwnAccount);

                        return (
                          <>
                            {canEdit && (
                              <Link href={`/admin/users/${user.id}/edit`}>
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            users
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <BulkOperationsDialog
        open={bulkOperationOpen}
        onOpenChange={setBulkOperationOpen}
        operation={bulkOperationType}
        selectedUserIds={Array.from(selectedUserIds)}
        onSuccess={() => {
          setSelectedUserIds(new Set());
          fetchUsers();
        }}
      />

      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onSuccess={() => {
          fetchUsers();
        }}
      />
    </div>
  );
}
