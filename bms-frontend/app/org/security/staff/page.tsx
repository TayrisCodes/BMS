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
import { apiGet, apiDelete } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Shield, Plus, Search, Edit, Trash2, Eye } from 'lucide-react';

interface SecurityStaff {
  id: string;
  userId: string;
  organizationId: string;
  buildingId?: string | null;
  assignedBuildings?: string[];
  employeeId?: string | null;
  badgeNumber?: string | null;
  hireDate?: string | null;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship?: string;
  } | null;
  certifications?: Array<{
    name: string;
    issuedDate: string;
    expiryDate?: string | null;
    issuer?: string | null;
  }> | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function SecurityStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<SecurityStaff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<SecurityStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchStaff() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ staff: SecurityStaff[] }>('/api/security/staff');
        setStaff(data.staff || []);
        setFilteredStaff(data.staff || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load security staff');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStaff();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredStaff(staff);
      return;
    }

    const filtered = staff.filter((s) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        s.employeeId?.toLowerCase().includes(searchLower) ||
        s.badgeNumber?.toLowerCase().includes(searchLower) ||
        s.notes?.toLowerCase().includes(searchLower)
      );
    });

    setFilteredStaff(filtered);
  }, [searchTerm, staff]);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this security staff profile?')) {
      return;
    }

    try {
      await apiDelete(`/api/security/staff/${id}`);
      setStaff(staff.filter((s) => s.id !== id));
      setFilteredStaff(filteredStaff.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete security staff');
    }
  }

  return (
    <DashboardPage
      title="Security Staff"
      description="Manage security staff and guards"
      icon={<Shield className="h-5 w-5" />}
    >
      <div className="col-span-full flex justify-between items-center">
        <div className="flex gap-2">
          <Link href="/org/security/staff/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register Security Guard
            </Button>
          </Link>
        </div>
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
            placeholder="Search by employee ID, badge number, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Badge Number</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Hire Date</TableHead>
              <TableHead>Certifications</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">Loading security staff...</p>
                </TableCell>
              </TableRow>
            ) : filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {staff.length === 0
                      ? 'No security staff found. Register your first guard.'
                      : 'No staff match your search.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.employeeId || 'N/A'}</TableCell>
                  <TableCell>{s.badgeNumber || 'N/A'}</TableCell>
                  <TableCell>
                    {s.buildingId ? (
                      <Badge variant="outline">Building {s.buildingId.slice(-6)}</Badge>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    {s.hireDate ? new Date(s.hireDate).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {s.certifications && s.certifications.length > 0 ? (
                      <Badge variant="secondary">{s.certifications.length} cert(s)</Badge>
                    ) : (
                      'None'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/org/security/staff/${s.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/org/security/staff/${s.id}`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
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
