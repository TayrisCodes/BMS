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
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Users, Plus, Search, Edit, Trash2, Eye, Phone, Mail } from 'lucide-react';

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email?: string | null;
  language?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: string;
  updatedAt?: string;
}

export default function OrgTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchTenants() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ tenants: Tenant[] }>('/api/tenants')) as {
          tenants: Tenant[];
        };
        setTenants(data.tenants || []);
        setFilteredTenants(data.tenants || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenants');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTenants();
  }, []);

  useEffect(() => {
    let filtered = tenants;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.primaryPhone.includes(searchTerm) ||
          t.email?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    setFilteredTenants(filtered);
  }, [searchTerm, statusFilter, tenants]);

  async function handleDelete(tenantId: string) {
    if (!confirm('Are you sure you want to delete this tenant?')) {
      return;
    }

    try {
      await apiDelete(`/api/tenants/${tenantId}`);
      setTenants(tenants.filter((t) => t._id !== tenantId));
      setFilteredTenants(filteredTenants.filter((t) => t._id !== tenantId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete tenant');
    }
  }

  function getStatusBadgeVariant(
    status: Tenant['status'],
  ): 'default' | 'secondary' | 'destructive' {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'default';
    }
  }


  return (
    <DashboardPage
      title="Tenants"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Tenants', href: '/org/tenants' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Manage all tenants in your organization</p>
        </div>
        <Link href="/admin/tenants/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
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
            placeholder="Search by name, phone, email, or national ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">Loading tenants...</p>
                </TableCell>
              </TableRow>
            ) : filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {tenants.length === 0
                      ? 'No tenants found. Create your first tenant.'
                      : 'No tenants match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((tenant) => (
                <TableRow key={tenant._id}>
                  <TableCell className="font-medium">
                    {`${tenant.firstName} ${tenant.lastName}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{tenant.primaryPhone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tenant.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{tenant.email}</span>
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tenant.language || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(tenant.status)}>{tenant.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/tenants/${tenant._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/tenants/${tenant._id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(tenant._id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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

