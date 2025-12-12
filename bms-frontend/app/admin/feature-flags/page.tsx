'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Switch } from '@/lib/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Textarea } from '@/lib/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/utils/api-client';
import { Flag, Plus, Edit, Trash2, Loader2, Globe, Building2, Save, X } from 'lucide-react';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  organizationId?: string | null;
  rolloutPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [filter, setFilter] = useState<'all' | 'global' | 'organization'>('all');

  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    enabled: false,
    organizationId: '',
    rolloutPercentage: 100,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [flagsData, orgsData] = await Promise.all([
          apiGet<{ flags: FeatureFlag[] }>('/api/admin/feature-flags'),
          apiGet<{ organizations: Array<{ id: string; name: string }> }>(
            '/api/organizations',
          ).catch(() => ({ organizations: [] })),
        ]);

        setFlags(flagsData.flags || []);
        setOrganizations(orgsData.organizations || []);
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.error || err?.message || 'Failed to load feature flags';
        // Check if it's a connection error
        if (
          errorMessage.includes('connection') ||
          errorMessage.includes('Database') ||
          errorMessage.includes('503')
        ) {
          setError(
            'Unable to connect to the database. Please check your MongoDB connection or try again later.',
          );
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredFlags = flags.filter((flag) => {
    if (filter === 'global') return flag.organizationId === null;
    if (filter === 'organization') return flag.organizationId !== null;
    return true;
  });

  const handleOpenModal = (flag?: FeatureFlag) => {
    if (flag) {
      setEditingFlag(flag);
      setFormData({
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        organizationId: flag.organizationId || '',
        rolloutPercentage: flag.rolloutPercentage,
      });
    } else {
      setEditingFlag(null);
      setFormData({
        key: '',
        name: '',
        description: '',
        enabled: false,
        organizationId: '',
        rolloutPercentage: 100,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingFlag(null);
    setFormData({
      key: '',
      name: '',
      description: '',
      enabled: false,
      organizationId: '',
      rolloutPercentage: 100,
    });
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name) {
      setError('Key and name are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingFlag) {
        await apiPatch('/api/admin/feature-flags', {
          id: editingFlag.id,
          enabled: formData.enabled,
          rolloutPercentage: formData.rolloutPercentage,
          name: formData.name,
          description: formData.description,
        });
        setSuccessMessage('Feature flag updated successfully');
      } else {
        await apiPost('/api/admin/feature-flags', {
          key: formData.key,
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          organizationId: formData.organizationId || null,
          rolloutPercentage: formData.rolloutPercentage,
        });
        setSuccessMessage('Feature flag created successfully');
      }

      // Refresh flags
      const flagsData = await apiGet<{ flags: FeatureFlag[] }>('/api/admin/feature-flags');
      setFlags(flagsData.flags || []);
      handleCloseModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feature flag');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await apiPatch('/api/admin/feature-flags', {
        id: flag.id,
        enabled: !flag.enabled,
      });

      // Update local state
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle feature flag');
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    if (!confirm(`Are you sure you want to delete the feature flag "${flag.name}"?`)) {
      return;
    }

    try {
      await apiDelete(`/api/admin/feature-flags?id=${flag.id}`);
      setFlags((prev) => prev.filter((f) => f.id !== flag.id));
      setSuccessMessage('Feature flag deleted successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feature flag');
    }
  };

  const getOrganizationName = (orgId: string | null | undefined): string => {
    if (!orgId) return 'Global';
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || orgId;
  };

  return (
    <DashboardPage
      title="Feature Flags"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Feature Flags', href: '/admin/feature-flags' },
      ]}
    >
      <div className="col-span-full">
        {successMessage && (
          <div className="mb-4 p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm border border-green-200 dark:border-green-800">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Flag className="h-8 w-8" />
              Feature Flags
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage feature flags for gradual rollouts and A/B testing
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Flags</SelectItem>
                <SelectItem value="global">Global Flags</SelectItem>
                <SelectItem value="organization">Organization Flags</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4 mr-2" />
              New Feature Flag
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Feature Flags ({filteredFlags.length})</CardTitle>
            <CardDescription>
              {filter === 'global' && 'Global flags apply to all organizations'}
              {filter === 'organization' && 'Organization-specific feature flags'}
              {filter === 'all' && 'All feature flags across the platform'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFlags.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No feature flags found</p>
                <Button onClick={() => handleOpenModal()} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Feature Flag
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flag</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rollout</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFlags.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{flag.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {flag.key}
                            </div>
                            {flag.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {flag.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {flag.organizationId ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Building2 className="h-3 w-3" />
                              {getOrganizationName(flag.organizationId)}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <Globe className="h-3 w-3" />
                              Global
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={flag.enabled}
                            onCheckedChange={() => handleToggle(flag)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${flag.rolloutPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {flag.rolloutPercentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(flag)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(flag)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingFlag ? 'Edit Feature Flag' : 'Create Feature Flag'}</DialogTitle>
            <DialogDescription>
              {editingFlag
                ? 'Update feature flag settings'
                : 'Create a new feature flag for gradual rollout or A/B testing'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key">Flag Key *</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="feature-name"
                disabled={!!editingFlag}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier (cannot be changed after creation)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Flag Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Feature Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this feature flag controls..."
                rows={3}
              />
            </div>

            {!editingFlag && (
              <div className="space-y-2">
                <Label htmlFor="organizationId">Scope</Label>
                <Select
                  value={formData.organizationId || 'global'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, organizationId: value === 'global' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Organizations)</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Global flags apply to all organizations. Organization flags apply to a specific
                  organization.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rolloutPercentage">Rollout Percentage</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="rolloutPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.rolloutPercentage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rolloutPercentage: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-32"
                />
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${formData.rolloutPercentage}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of users/organizations that should have this feature enabled
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-sm text-muted-foreground">Enable or disable this feature flag</p>
              </div>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.key || !formData.name}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {editingFlag ? 'Update' : 'Create'} Flag
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
