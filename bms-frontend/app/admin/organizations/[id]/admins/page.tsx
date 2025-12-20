'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Users, ArrowLeft, Plus, Edit, Trash2, Eye, AlertTriangle, Shield } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import type { UserStatus } from '@/lib/auth/types';

interface Admin {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  status: UserStatus;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function OrganizationAdminsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await apiGet<{
          admins: Admin[];
          organization: Organization;
        }>(`/api/organizations/${organizationId}/admins`);

        setAdmins(data.admins || []);
        setOrganization(data.organization);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization admins');
      } finally {
        setIsLoading(false);
      }
    }

    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  async function handleDelete(adminId: string) {
    if (!confirm('Are you sure you want to remove this organization admin?')) {
      return;
    }

    try {
      await apiDelete(`/api/organizations/${organizationId}/admins/${adminId}`);
      // Refresh the list
      const data = await apiGet<{
        admins: Admin[];
        organization: Organization;
      }>(`/api/organizations/${organizationId}/admins`);
      setAdmins(data.admins || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete admin');
    }
  }

  const activeAdmins = admins.filter((a) => a.status === 'active').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Organization Admins</h1>
            <p className="text-muted-foreground">
              {organization ? `Manage admins for ${organization.name}` : 'Loading...'}
            </p>
          </div>
        </div>
        <Link href={`/admin/organizations/${organizationId}/admins/create`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Admin
          </Button>
        </Link>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      {/* Warning if no active admins */}
      {!isLoading && activeAdmins === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="font-semibold text-yellow-800 dark:text-yellow-200">No Active Admins</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This organization has no active administrators. Please create at least one admin to
              ensure proper management.
            </p>
          </div>
        </div>
      )}

      {/* Stats Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{admins.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeAdmins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive/Invited</CardTitle>
            <Users className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{admins.length - activeAdmins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Admins Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading admins...</p>
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    No admins found. Create the first organization admin.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.name || admin.email || admin.phone || 'N/A'}
                  </TableCell>
                  <TableCell>{admin.email || 'N/A'}</TableCell>
                  <TableCell>{admin.phone}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        admin.status === 'active'
                          ? 'default'
                          : admin.status === 'inactive' || admin.status === 'suspended'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {admin.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/users/${admin.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/users/${admin.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      {admin.status === 'active' && activeAdmins > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(admin.id)}>
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
    </div>
  );
}

