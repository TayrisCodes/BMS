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
import { Building2, Plus, Search, Edit, Trash2, Eye } from 'lucide-react';

interface Building {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
  buildingType: 'residential' | 'commercial' | 'mixed';
  totalFloors?: number | null;
  totalUnits?: number | null;
  status: 'active' | 'under-construction' | 'inactive';
  managerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function OrgBuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [filteredBuildings, setFilteredBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchBuildings() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ buildings: Building[] }>('/api/buildings')) as {
          buildings: Building[];
        };
        setBuildings(data.buildings || []);
        setFilteredBuildings(data.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load buildings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBuildings();
  }, []);

  useEffect(() => {
    let filtered = buildings;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.address?.street?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.address?.city?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    setFilteredBuildings(filtered);
  }, [searchTerm, statusFilter, buildings]);

  async function handleDelete(buildingId: string) {
    if (!confirm('Are you sure you want to delete this building?')) {
      return;
    }

    try {
      await apiDelete(`/api/buildings/${buildingId}`);
      setBuildings(buildings.filter((b) => b._id !== buildingId));
      setFilteredBuildings(filteredBuildings.filter((b) => b._id !== buildingId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete building');
    }
  }

  function getStatusBadgeVariant(
    status: Building['status'],
  ): 'default' | 'secondary' | 'destructive' {
    switch (status) {
      case 'active':
        return 'default';
      case 'under-construction':
        return 'secondary';
      case 'inactive':
        return 'destructive';
      default:
        return 'default';
    }
  }

  function formatAddress(address: Building['address']): string {
    if (!address) return 'N/A';
    const parts = [address.street, address.city, address.region, address.postalCode].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  return (
    <DashboardPage
      title="Buildings"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Buildings', href: '/org/buildings' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Manage your building portfolio</p>
        </div>
        <Link href="/admin/buildings/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Building
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
            placeholder="Search by name or address..."
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
            <SelectItem value="under-construction">Under Construction</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Floors</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading buildings...</p>
                </TableCell>
              </TableRow>
            ) : filteredBuildings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {buildings.length === 0
                      ? 'No buildings found. Create your first building.'
                      : 'No buildings match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredBuildings.map((building) => (
                <TableRow key={building._id}>
                  <TableCell className="font-medium">{building.name}</TableCell>
                  <TableCell>{formatAddress(building.address)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{building.buildingType}</Badge>
                  </TableCell>
                  <TableCell>{building.totalFloors ?? 'N/A'}</TableCell>
                  <TableCell>{building.totalUnits ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(building.status)}>
                      {building.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/buildings/${building._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/buildings/${building._id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(building._id)}>
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





