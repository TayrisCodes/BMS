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
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { Users, Plus, Search, Edit, Trash2, Eye, AlertTriangle, Loader2 } from 'lucide-react';
import type { UserRole, UserStatus } from '@/lib/auth/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  roles: UserRole[];
  status: UserStatus;
  organizationId?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export default function UsersSettingsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const profile = await apiGet<{ id?: string }>('/api/users/me');
        setCurrentUserId(profile.id || null);
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      }
    }
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ users: User[] }>('/api/users')) as { users: User[] };
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.phone.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.roles.includes(roleFilter as UserRole));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, statusFilter, users]);

  function openDeleteModal(user: User) {
    setUserToDelete(user);
    setDeleteConfirmationText('');
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setUserToDelete(null);
    setDeleteConfirmationText('');
  }

  async function confirmDelete() {
    if (!userToDelete) return;

    // Get the primary role (first role in the array)
    const primaryRole = userToDelete.roles[0] || '';
    const requiredText = primaryRole;

    // Validate that the confirmation text matches
    if (deleteConfirmationText.trim() !== requiredText) {
      return;
    }

    setIsDeleting(true);
    try {
      await apiDelete(`/api/users/${userToDelete.id}`);
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      setFilteredUsers(filteredUsers.filter((u) => u.id !== userToDelete.id));
      closeDeleteModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  }

  // Get the required confirmation text based on user's primary role
  const getRequiredConfirmationText = () => {
    if (!userToDelete) return '';
    return userToDelete.roles[0] || '';
  };

  const isDeleteEnabled = () => {
    const requiredText = getRequiredConfirmationText();
    return deleteConfirmationText.trim() === requiredText;
  };

  function getStatusBadgeVariant(
    status: UserStatus,
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'active':
        return 'default';
      case 'invited':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      case 'inactive':
        return 'outline';
      default:
        return 'default';
    }
  }

  function formatRoles(roles: UserRole[]): string {
    return roles.join(', ');
  }

  return (
    <DashboardPage
      title="Users & Roles"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Settings', href: '/org/settings' },
        { label: 'Users & Roles', href: '/org/settings/users' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Manage users and their roles</p>
        </div>
        <Link href="/admin/users/invite">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </Link>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
            <SelectItem value="BUILDING_MANAGER">Building Manager</SelectItem>
            <SelectItem value="FACILITY_MANAGER">Facility Manager</SelectItem>
            <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
            <SelectItem value="SECURITY">Security</SelectItem>
            <SelectItem value="TECHNICIAN">Technician</SelectItem>
            <SelectItem value="AUDITOR">Auditor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">Loading users...</p>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {users.length === 0
                      ? 'No users found. Invite your first user.'
                      : 'No users match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || user.email || user.phone || 'N/A'}
                  </TableCell>
                  <TableCell>{user.email || 'N/A'}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(user.status)}>{user.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/users/${user.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      {/* Hide delete button for current user's own row */}
                      {currentUserId !== user.id && (
                        <Button variant="ghost" size="sm" onClick={() => openDeleteModal(user)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <DialogTitle>Delete User Account</DialogTitle>
            </div>
            <DialogDescription className="pt-4">
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="font-semibold text-destructive mb-2">
                    Warning: This action cannot be undone!
                  </p>
                  <p className="text-sm">
                    If you delete this account, the user will lose access to everything:
                  </p>
                  <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-muted-foreground">
                    <li>All account data and settings</li>
                    <li>Access to the system</li>
                    <li>Associated records and history</li>
                  </ul>
                </div>
                {userToDelete && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      To confirm deletion, please type the user&apos;s role:{' '}
                      <span className="font-bold text-primary">
                        {getRequiredConfirmationText()}
                      </span>
                    </p>
                    <Input
                      placeholder={`Type "${getRequiredConfirmationText()}" to confirm`}
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      className="mt-2"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteModal} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!isDeleteEnabled() || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Yes, Delete Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
