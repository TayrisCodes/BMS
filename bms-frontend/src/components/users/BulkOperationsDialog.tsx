'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Button } from '@/lib/components/ui/button';
import { Label } from '@/lib/components/ui/label';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { UserRole, UserStatus } from '@/lib/auth/types';

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'invite' | 'update' | 'delete';
  selectedUserIds?: string[];
  onSuccess?: () => void;
}

export function BulkOperationsDialog({
  open,
  onOpenChange,
  operation,
  selectedUserIds = [],
  onSuccess,
}: BulkOperationsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ identifier: string; success: boolean; error?: string }>;
  } | null>(null);

  // For bulk invite
  const [inviteData, setInviteData] = useState({
    users: [{ email: '', phone: '', name: '', roles: [] as UserRole[] }],
    createType: 'invite' as 'invite' | 'direct',
    password: '',
  });

  // For bulk update
  const [updateData, setUpdateData] = useState<{
    status?: UserStatus;
    roles?: UserRole[];
  }>({});

  const handleBulkInvite = async () => {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/users/bulk/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: inviteData.users.filter((u) => u.phone.trim()),
          createType: inviteData.createType,
          password: inviteData.createType === 'direct' ? inviteData.password : undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResults(data);
        if (onSuccess) onSuccess();
      } else {
        setResults({
          total: inviteData.users.length,
          successful: 0,
          failed: inviteData.users.length,
          results: inviteData.users.map((u) => ({
            identifier: u.email || u.phone,
            success: false,
            error: data.error || 'Failed to invite',
          })),
        });
      }
    } catch (error) {
      console.error('Bulk invite error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!selectedUserIds.length) return;

    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/users/bulk/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
          updates: updateData,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResults(data);
        if (onSuccess) onSuccess();
      } else {
        setResults({
          total: selectedUserIds.length,
          successful: 0,
          failed: selectedUserIds.length,
          results: selectedUserIds.map((id) => ({
            identifier: id,
            success: false,
            error: data.error || 'Failed to update',
          })),
        });
      }
    } catch (error) {
      console.error('Bulk update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedUserIds.length) return;
    if (!confirm(`Are you sure you want to delete ${selectedUserIds.length} users?`)) return;

    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/users/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResults(data);
        if (onSuccess) onSuccess();
      } else {
        setResults({
          total: selectedUserIds.length,
          successful: 0,
          failed: selectedUserIds.length,
          results: selectedUserIds.map((id) => ({
            identifier: id,
            success: false,
            error: data.error || 'Failed to delete',
          })),
        });
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (operation === 'invite') handleBulkInvite();
    else if (operation === 'update') handleBulkUpdate();
    else if (operation === 'delete') handleBulkDelete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Bulk {operation === 'invite' ? 'Invite' : operation === 'update' ? 'Update' : 'Delete'}{' '}
            Users
          </DialogTitle>
          <DialogDescription>
            {operation === 'invite' && 'Invite multiple users at once (up to 50 per batch)'}
            {operation === 'update' &&
              `Update ${selectedUserIds.length} selected users (status or roles)`}
            {operation === 'delete' &&
              `Delete ${selectedUserIds.length} selected users (soft delete - sets status to inactive)`}
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            {operation === 'invite' && (
              <div className="space-y-4">
                <div>
                  <Label>Users (up to 50)</Label>
                  <div className="space-y-2 mt-2">
                    {inviteData.users.map((user, index) => (
                      <div key={index} className="grid grid-cols-4 gap-2">
                        <Input
                          placeholder="Name (optional)"
                          value={user.name}
                          onChange={(e) => {
                            const newUsers = [...inviteData.users];
                            if (newUsers[index]) {
                              newUsers[index].name = e.target.value;
                            }
                            setInviteData({ ...inviteData, users: newUsers });
                          }}
                        />
                        <Input
                          placeholder="Email"
                          type="email"
                          value={user.email}
                          onChange={(e) => {
                            const newUsers = [...inviteData.users];
                            if (newUsers[index]) {
                              newUsers[index].email = e.target.value;
                            }
                            setInviteData({ ...inviteData, users: newUsers });
                          }}
                        />
                        <Input
                          placeholder="Phone *"
                          value={user.phone}
                          onChange={(e) => {
                            const newUsers = [...inviteData.users];
                            if (newUsers[index]) {
                              newUsers[index].phone = e.target.value;
                            }
                            setInviteData({ ...inviteData, users: newUsers });
                          }}
                          required
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInviteData({
                              ...inviteData,
                              users: inviteData.users.filter((_, i) => i !== index),
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {inviteData.users.length < 50 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setInviteData({
                            ...inviteData,
                            users: [
                              ...inviteData.users,
                              { email: '', phone: '', name: '', roles: [] },
                            ],
                          });
                        }}
                      >
                        Add User
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Creation Type</Label>
                  <Select
                    value={inviteData.createType}
                    onValueChange={(value: 'invite' | 'direct') =>
                      setInviteData({ ...inviteData, createType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invite">Send Invitation</SelectItem>
                      <SelectItem value="direct">Create Directly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteData.createType === 'direct' && (
                  <div>
                    <Label>Password (for all users)</Label>
                    <Input
                      type="password"
                      value={inviteData.password}
                      onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                      placeholder="Enter password (min 8 characters)"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Note: Roles must be assigned individually after creation. Use CSV import for bulk
                  role assignment.
                </p>
              </div>
            )}

            {operation === 'update' && (
              <div className="space-y-4">
                <div>
                  <Label>Update Status</Label>
                  <Select
                    value={updateData.status || 'none'}
                    onValueChange={(value) =>
                      setUpdateData({
                        ...updateData,
                        ...(value !== 'none' ? { status: value as UserStatus } : {}),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No change" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No change</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Role updates must be done individually. Use the user edit page for role
                  changes.
                </p>
              </div>
            )}

            {operation === 'delete' && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This will soft delete {selectedUserIds.length} users (set status to inactive).
                  This action cannot be undone easily.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Process ${operation === 'invite' ? inviteData.users.length : selectedUserIds.length} Users`
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{results.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {results.results.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {results.results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded text-sm">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="flex-1">{result.identifier}</span>
                    {result.error && <span className="text-xs text-red-600">{result.error}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
