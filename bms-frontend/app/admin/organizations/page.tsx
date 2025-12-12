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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { apiGet } from '@/lib/utils/api-client';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Users,
  FileText,
  Edit,
  Download,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import { Checkbox } from '@/lib/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Label } from '@/lib/components/ui/label';
import { apiPost, apiPatch } from '@/lib/utils/api-client';

interface Organization {
  id: string;
  _id?: string; // Support both formats
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<'updateStatus' | 'assignSubscription' | null>(
    null,
  );
  const [bulkStatus, setBulkStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    totalBuildings: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setIsLoading(true);
        setError(null);
        const data = (await apiGet<{ organizations: Organization[] }>('/api/organizations')) as {
          organizations: Organization[];
        };

        // Normalize id/_id field
        const normalized = (data.organizations || []).map((org) => {
          const orgId = (org.id || org._id || '') as string;
          return {
            ...org,
            _id: (org._id || orgId) as string,
            id: orgId,
          } as Organization;
        });

        setOrganizations(normalized);
        setFilteredOrganizations(normalized);
        setStats({
          total: normalized.length,
          totalBuildings: 0, // Will be fetched separately if needed
          totalUsers: 0, // Will be fetched separately if needed
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  useEffect(() => {
    let filtered = organizations;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (org) =>
          org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org.contactInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org.contactInfo?.phone?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    setFilteredOrganizations(filtered);
  }, [searchTerm, organizations]);

  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  }

  function getOrgId(org: Organization): string {
    return org._id || org.id;
  }

  const handleSelectAll = () => {
    if (selectedOrgs.size === filteredOrganizations.length) {
      setSelectedOrgs(new Set());
    } else {
      setSelectedOrgs(new Set(filteredOrganizations.map((org) => getOrgId(org))));
    }
  };

  const handleSelectOrg = (orgId: string) => {
    const newSelected = new Set(selectedOrgs);
    if (newSelected.has(orgId)) {
      newSelected.delete(orgId);
    } else {
      newSelected.add(orgId);
    }
    setSelectedOrgs(newSelected);
  };

  const handleBulkOperation = async () => {
    if (selectedOrgs.size === 0 || !bulkOperation) return;

    setBulkSaving(true);
    try {
      const payload: any = {
        organizationIds: Array.from(selectedOrgs),
        operation: bulkOperation,
        data: {},
      };

      if (bulkOperation === 'updateStatus') {
        payload.data.status = bulkStatus;
      }

      await apiPatch('/api/admin/organizations/bulk', payload);

      // Refresh organizations
      const data = await apiGet<{ organizations: Organization[] }>('/api/organizations');
      const normalized = (data.organizations || []).map((org) => {
        const orgId = (org.id || org._id || '') as string;
        return {
          ...org,
          _id: (org._id || orgId) as string,
          id: orgId,
        } as Organization;
      });
      setOrganizations(normalized);
      setFilteredOrganizations(normalized);
      setSelectedOrgs(new Set());
      setBulkActionOpen(false);
      setBulkOperation(null);
    } catch (err) {
      console.error('Bulk operation failed:', err);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await fetch('/api/admin/organizations/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationIds: selectedOrgs.size > 0 ? Array.from(selectedOrgs) : undefined,
          format,
        }),
      });

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `organizations-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `organizations-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Organizations</h1>
            <p className="text-muted-foreground">Manage platform organizations</p>
          </div>
        </div>
        <Link href="/admin/organizations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBuildings}</div>
            <p className="text-xs text-muted-foreground">Across all organizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Across all organizations</p>
          </CardContent>
        </Card>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedOrgs.size > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkOperation('updateStatus');
                setBulkActionOpen(true);
              }}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Bulk Update ({selectedOrgs.size})
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedOrgs(new Set())}>
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedOrgs.size === filteredOrganizations.length &&
                    filteredOrganizations.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Contact Phone</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrganizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {organizations.length === 0
                      ? 'No organizations found. Create your first organization.'
                      : 'No organizations match your search.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrganizations.map((org) => {
                const orgId = getOrgId(org);
                const isSelected = selectedOrgs.has(orgId);
                return (
                  <TableRow key={orgId}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectOrg(orgId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.code}</Badge>
                    </TableCell>
                    <TableCell>{org.contactInfo?.email || 'N/A'}</TableCell>
                    <TableCell>{org.contactInfo?.phone || 'N/A'}</TableCell>
                    <TableCell>{formatDate(org.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/organizations/${getOrgId(org)}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/organizations/${getOrgId(org)}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Operation</DialogTitle>
            <DialogDescription>
              Update {selectedOrgs.size} selected organization(s)
            </DialogDescription>
          </DialogHeader>
          {bulkOperation === 'updateStatus' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={bulkStatus} onValueChange={(value: any) => setBulkStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkOperation} disabled={bulkSaving}>
              {bulkSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
