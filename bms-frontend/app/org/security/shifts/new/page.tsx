'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/lib/components/ui/card';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';

interface SecurityStaff {
  id: string;
  userId: string;
  employeeId?: string | null;
  badgeNumber?: string | null;
}

interface Building {
  _id: string;
  name: string;
}

export default function NewShiftPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityStaff, setSecurityStaff] = useState<SecurityStaff[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [formData, setFormData] = useState({
    buildingId: '',
    securityStaffId: '',
    shiftType: 'morning' as 'morning' | 'afternoon' | 'night' | 'custom',
    startTime: '',
    endTime: '',
    notes: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [staffData, buildingsData] = await Promise.all([
          apiGet<{ staff: SecurityStaff[] }>('/api/security/staff'),
          apiGet<{ buildings: Building[] }>('/api/buildings'),
        ]);

        setSecurityStaff(staffData.staff || []);
        setBuildings(buildingsData.buildings || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    fetchData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId,
        securityStaffId: formData.securityStaffId,
        shiftType: formData.shiftType,
        startTime: formData.startTime,
        endTime: formData.endTime,
        notes: formData.notes || null,
      };

      await apiPost('/api/security/shifts', payload);
      router.push('/org/security/shifts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/security/shifts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Shift</h1>
          <p className="text-muted-foreground">Schedule a new security shift</p>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Details
            </CardTitle>
            <CardDescription>Enter shift information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buildingId">Building *</Label>
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) => setFormData({ ...formData, buildingId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="securityStaffId">Security Staff *</Label>
                <Select
                  value={formData.securityStaffId}
                  onValueChange={(value) => setFormData({ ...formData, securityStaffId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select security staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {securityStaff.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.employeeId || staff.badgeNumber || staff.userId.slice(-6)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shiftType">Shift Type *</Label>
                <Select
                  value={formData.shiftType}
                  onValueChange={(value: 'morning' | 'afternoon' | 'night' | 'custom') =>
                    setFormData({ ...formData, shiftType: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/org/security/shifts">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.buildingId || !formData.securityStaffId}
          >
            {isSubmitting ? 'Creating...' : 'Create Shift'}
          </Button>
        </div>
      </form>
    </div>
  );
}
