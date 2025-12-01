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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { ArrowLeft, Plus, Package, Edit, Trash2, Eye } from 'lucide-react';

interface Unit {
  _id: string;
  unitNumber: string;
  floor?: number | null;
  unitType: string;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: string;
  rentAmount?: number | null;
}

export default function BuildingUnitsPage() {
  const params = useParams();
  const router = useRouter();
  const buildingId = params.id as string;
  const [units, setUnits] = useState<Unit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchUnits() {
      try {
        setIsLoading(true);
        const data = (await apiGet<{ units: Unit[] }>(`/api/units?buildingId=${buildingId}`)) as {
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

    if (buildingId) {
      fetchUnits();
    }
  }, [buildingId]);

  useEffect(() => {
    let filtered = units;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((u) => u.unitType === typeFilter);
    }

    setFilteredUnits(filtered);
  }, [statusFilter, typeFilter, units]);

  async function handleDelete(unitId: string) {
    if (!confirm('Are you sure you want to delete this unit?')) {
      return;
    }

    try {
      await apiDelete(`/api/units/${unitId}`);
      setUnits(units.filter((u) => u._id !== unitId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/admin/buildings/${buildingId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Units</h1>
            <p className="text-muted-foreground">Manage units in this building</p>
          </div>
        </div>
        <Link href={`/admin/buildings/${buildingId}/units/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Unit
          </Button>
        </Link>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <div className="flex gap-4 items-center">
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
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="office">Office</SelectItem>
            <SelectItem value="shop">Shop</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
            <SelectItem value="parking">Parking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit Number</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Area (m²)</TableHead>
              <TableHead>Bedrooms</TableHead>
              <TableHead>Bathrooms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rent (ETB)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {units.length === 0
                      ? 'No units found. Add your first unit.'
                      : 'No units match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUnits.map((unit) => (
                <TableRow key={unit._id}>
                  <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                  <TableCell>{unit.floor ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{unit.unitType}</Badge>
                  </TableCell>
                  <TableCell>{unit.area ?? 'N/A'}</TableCell>
                  <TableCell>{unit.bedrooms ?? 'N/A'}</TableCell>
                  <TableCell>{unit.bathrooms ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        unit.status === 'occupied'
                          ? 'default'
                          : unit.status === 'available'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {unit.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {unit.rentAmount ? `ETB ${unit.rentAmount.toLocaleString()}` : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/units/${unit._id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
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
    </div>
  );
}

