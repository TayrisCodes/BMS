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
import { Package, Plus, Search, Edit, Trash2, Eye, Building2 } from 'lucide-react';

interface Unit {
  _id: string;
  unitNumber: string;
  buildingId?: string;
  buildingName?: string;
  floor?: number | null;
  unitType: string;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  rentAmount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export default function OrgUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchUnits() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ units: Unit[] }>('/api/units')) as {
          units: Unit[];
        };
        setUnits(data.units || []);
        setFilteredUnits(data.units || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load units');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUnits();
  }, []);

  useEffect(() => {
    let filtered = units;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (u) =>
          u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.buildingName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.unitType.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((u) => u.unitType === typeFilter);
    }

    setFilteredUnits(filtered);
  }, [searchTerm, statusFilter, typeFilter, units]);

  async function handleDelete(unitId: string) {
    if (!confirm('Are you sure you want to delete this unit?')) {
      return;
    }

    try {
      await apiDelete(`/api/units/${unitId}`);
      setUnits(units.filter((u) => u._id !== unitId));
      setFilteredUnits(filteredUnits.filter((u) => u._id !== unitId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  }

  function getStatusBadgeVariant(
    status: Unit['status'],
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'available':
        return 'default';
      case 'occupied':
        return 'secondary';
      case 'maintenance':
        return 'destructive';
      case 'reserved':
        return 'outline';
      default:
        return 'default';
    }
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount);
  }

  // Get unique unit types for filter
  const unitTypes = Array.from(new Set(units.map((u) => u.unitType))).filter(Boolean);

  return (
    <DashboardPage
      title="Units"
      breadcrumbs={[
        { label: 'Organization', href: '/org' },
        { label: 'Units', href: '/org/units' },
      ]}
    >
      <div className="col-span-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <p className="text-muted-foreground">Manage all units across your buildings</p>
        </div>
        <Link href="/admin/units/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Unit
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
            placeholder="Search by unit number, building, or type..."
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
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {unitTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit Number</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Bedrooms</TableHead>
              <TableHead>Bathrooms</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <p className="text-muted-foreground">Loading units...</p>
                </TableCell>
              </TableRow>
            ) : filteredUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {units.length === 0
                      ? 'No units found. Create your first unit.'
                      : 'No units match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUnits.map((unit) => (
                <TableRow key={unit._id}>
                  <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                  <TableCell>
                    {unit.buildingName ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{unit.buildingName}</span>
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>{unit.floor ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{unit.unitType}</Badge>
                  </TableCell>
                  <TableCell>{unit.area ? `${unit.area} m²` : 'N/A'}</TableCell>
                  <TableCell>{unit.bedrooms ?? 'N/A'}</TableCell>
                  <TableCell>{unit.bathrooms ?? 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(unit.rentAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(unit.status)}>{unit.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/units/${unit._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/units/${unit._id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(unit._id)}>
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

