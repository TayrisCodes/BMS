'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { Label } from '@/lib/components/ui/label';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import {
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  Calendar,
  Activity,
  AlertTriangle,
  Key,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Textarea } from '@/lib/components/ui/textarea';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import type { UserRole, UserStatus } from '@/lib/auth/types';
import { UserActivityLogs } from './UserActivityLogs';

interface UserDetail {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  roles: UserRole[];
  status: UserStatus;
  organizationId?: string;
  organizationName?: string;
  invitedBy?: string | null;
  invitedAt?: string | null;
  activatedAt?: string | null;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingRoles, setUpdatingRoles] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<UserDetail>(`/api/users/${userId}`);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    async function checkPermissions() {
      try {
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        setCanEdit(roles.includes('ORG_ADMIN') || roles.includes('SUPER_ADMIN'));
        setCanDelete(roles.includes('ORG_ADMIN') || roles.includes('SUPER_ADMIN'));
      } catch (err) {
        console.error('Failed to check permissions:', err);
      }
    }
    checkPermissions();
    fetchUser();
  }, [fetchUser]);

  function handleStatusChangeRequest(newStatus: UserStatus) {
    if (!user || newStatus === user.status) return;
    setPendingStatus(newStatus);
    setSuspensionReason('');
    setStatusDialogOpen(true);
  }

  async function handleStatusChangeConfirm() {
    if (!pendingStatus) return;

    try {
      setUpdatingStatus(true);
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: pendingStatus,
          reason: pendingStatus === 'suspended' ? suspensionReason : undefined,
        }),
      });

      if (response.ok) {
        setStatusDialogOpen(false);
        setPendingStatus(null);
        setSuspensionReason('');
        await fetchUser();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleRolesChange(newRoles: UserRole[]) {
    if (!confirm('Are you sure you want to update user roles?')) {
      return;
    }

    try {
      setUpdatingRoles(true);
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roles: newRoles }),
      });

      if (response.ok) {
        await fetchUser();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update roles');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update roles');
    } finally {
      setUpdatingRoles(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm('Are you sure you want to delete this user? This will set their status to inactive.')
    ) {
      return;
    }

    try {
      await apiDelete(`/api/users/${userId}`);
      router.push('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  async function handlePasswordReset() {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!newPassword || !confirmPassword) {
      setPasswordError('Both password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    try {
      setResettingPassword(true);
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPasswordSuccess(false);
        }, 3000);
      } else {
        setPasswordError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error || 'User not found'}
        </div>
        <Link href="/admin/users">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{user.name || 'User'}</h1>
              <p className="text-muted-foreground">User details and management</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/admin/users/${userId}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>User&apos;s personal and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{user.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{user.phone}</p>
                  </div>
                </div>
                {user.organizationName && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="font-medium">{user.organizationName}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>User Roles</CardTitle>
              <CardDescription>Manage user role assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-sm">
                      {role.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              {canEdit && (
                <div className="space-y-2">
                  <Label>Update Roles</Label>
                  <p className="text-sm text-muted-foreground">
                    Select roles to assign. Note: You cannot remove the last ORG_ADMIN in an
                    organization.
                  </p>
                  <RoleSelector
                    currentRoles={user.roles}
                    onRolesChange={handleRolesChange}
                    disabled={updatingRoles}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>User Status</CardTitle>
              <CardDescription>Manage user account status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      user.status === 'active'
                        ? 'default'
                        : user.status === 'inactive' || user.status === 'suspended'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="text-sm"
                  >
                    {user.status}
                  </Badge>
                  {user.status === 'suspended' && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      User account is suspended
                    </span>
                  )}
                </div>
              </div>
              {canEdit && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Change Status</Label>
                    <div className="flex flex-wrap gap-2">
                      {user.status !== 'active' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChangeRequest('active')}
                          disabled={updatingStatus}
                        >
                          Activate
                        </Button>
                      )}
                      {user.status !== 'inactive' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChangeRequest('inactive')}
                          disabled={updatingStatus}
                        >
                          Deactivate
                        </Button>
                      )}
                      {user.status !== 'suspended' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChangeRequest('suspended')}
                          disabled={updatingStatus}
                        >
                          Suspend
                        </Button>
                      )}
                      {user.status === 'suspended' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStatusChangeRequest('active')}
                          disabled={updatingStatus}
                        >
                          Unsuspend
                        </Button>
                      )}
                    </div>
                    {updatingStatus && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating status...
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> You cannot deactivate or suspend the last ORG_ADMIN in
                      an organization. SUPER_ADMIN users cannot be deactivated or suspended.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Change Confirmation Dialog */}
          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Status Change</DialogTitle>
                <DialogDescription>
                  {pendingStatus === 'suspended' && (
                    <span>
                      You are about to suspend this user. Please provide a reason (optional).
                    </span>
                  )}
                  {pendingStatus === 'inactive' && (
                    <span>
                      You are about to deactivate this user. This will prevent them from accessing
                      the system.
                    </span>
                  )}
                  {pendingStatus === 'active' && user.status === 'suspended' && (
                    <span>
                      You are about to unsuspend this user. They will regain access to the system.
                    </span>
                  )}
                  {pendingStatus === 'active' && user.status !== 'suspended' && (
                    <span>
                      You are about to activate this user. They will be able to access the system.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Current Status</Label>
                  <p className="text-sm font-medium capitalize">{user.status}</p>
                </div>
                <div>
                  <Label>New Status</Label>
                  <p className="text-sm font-medium capitalize">{pendingStatus}</p>
                </div>
                {pendingStatus === 'suspended' && (
                  <div className="space-y-2">
                    <Label htmlFor="suspension-reason">
                      Suspension Reason <span className="text-muted-foreground">(Optional)</span>
                    </Label>
                    <Textarea
                      id="suspension-reason"
                      placeholder="Enter reason for suspension..."
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      This reason will be stored for audit purposes.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusDialogOpen(false);
                    setPendingStatus(null);
                    setSuspensionReason('');
                  }}
                  disabled={updatingStatus}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStatusChangeConfirm}
                  disabled={updatingStatus}
                  variant={
                    pendingStatus === 'suspended' || pendingStatus === 'inactive'
                      ? 'destructive'
                      : 'default'
                  }
                >
                  {updatingStatus ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Reset the password for this user. The user will need to use this new password to log
                in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canEdit ? (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> You can reset this user&apos;s password. The new password
                      must meet the following requirements:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside space-y-1">
                      <li>Minimum 8 characters</li>
                      <li>At least one uppercase letter</li>
                      <li>At least one lowercase letter</li>
                      <li>At least one number</li>
                      <li>At least one special character</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordError(null);
                          setPasswordSuccess(false);
                        }}
                        placeholder="Enter new password"
                        disabled={resettingPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError(null);
                          setPasswordSuccess(false);
                        }}
                        placeholder="Confirm new password"
                        disabled={resettingPassword}
                      />
                    </div>

                    {passwordError && (
                      <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
                        {passwordError}
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm">
                        Password reset successfully!
                      </div>
                    )}

                    <Button
                      onClick={handlePasswordReset}
                      disabled={resettingPassword || !newPassword || !confirmPassword}
                    >
                      {resettingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    You do not have permission to reset passwords. Only SUPER_ADMIN and ORG_ADMIN
                    can reset user passwords.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <UserActivityLogs userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Role Selector Component
function RoleSelector({
  currentRoles,
  onRolesChange,
  disabled,
}: {
  currentRoles: UserRole[];
  onRolesChange: (roles: UserRole[]) => void;
  disabled?: boolean;
}) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(currentRoles);

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

  const handleRoleToggle = (role: UserRole) => {
    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    setSelectedRoles(newRoles);
  };

  const handleSave = () => {
    if (selectedRoles.length === 0) {
      alert('At least one role is required');
      return;
    }
    onRolesChange(selectedRoles);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 border rounded-lg p-4">
        {allRoles.map((role) => (
          <div key={role} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={role}
              checked={selectedRoles.includes(role)}
              onChange={() => handleRoleToggle(role)}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            <label htmlFor={role} className="text-sm font-medium cursor-pointer">
              {role.replace(/_/g, ' ')}
            </label>
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={disabled || selectedRoles.length === 0}>
        {disabled ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          'Update Roles'
        )}
      </Button>
    </div>
  );
}
