'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Textarea } from '@/lib/components/ui/textarea';
import { Label } from '@/lib/components/ui/label';
import { Loader2, ArrowLeft, Save, Users } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { UserRole } from '@/lib/auth/types';

interface TechnicianProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  status: string;
  skills?: string[];
  availabilityNote?: string | null;
  shiftStatus?: string | null;
  lastLoginAt?: string | null;
  workload?: {
    active: number;
    completed: number;
    inProgress: number;
  };
}

export default function TechnicianProfilePage() {
  const router = useRouter();
  const params = useParams();
  const technicianId = params.id as string;

  const [profile, setProfile] = useState<TechnicianProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [shiftStatus, setShiftStatus] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await apiGet<any>(`/api/users/${technicianId}`);
      const workloadRes = await apiGet<{
        workOrders: Array<{ status: string }>;
      }>(`/api/work-orders?assignedTo=${technicianId}&limit=500`);

      const active = workloadRes.workOrders.filter(
        (wo) => wo.status === 'open' || wo.status === 'assigned' || wo.status === 'in_progress',
      ).length;
      const completed = workloadRes.workOrders.filter((wo) => wo.status === 'completed').length;
      const inProgress = workloadRes.workOrders.filter((wo) => wo.status === 'in_progress').length;

      const profileData: TechnicianProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        skills: user.skills || [],
        availabilityNote: user.availabilityNote || '',
        shiftStatus: user.shiftStatus || '',
        lastLoginAt: user.lastLoginAt || null,
        workload: {
          active,
          completed,
          inProgress,
        },
      };

      setProfile(profileData);
      setName(profileData.name || '');
      setEmail(profileData.email || '');
      setPhone(profileData.phone || '');
      setSkills((profileData.skills || []).join(', '));
      setAvailabilityNote(profileData.availabilityNote || '');
      setShiftStatus(profileData.shiftStatus || '');
    } catch (err) {
      console.error('Failed to fetch technician', err);
      setError(err instanceof Error ? err.message : 'Failed to load technician');
    } finally {
      setLoading(false);
    }
  }, [technicianId]);

  useEffect(() => {
    async function init() {
      try {
        const profile = await apiGet<{ roles: UserRole[] }>('/api/users/me');
        const roles = profile.roles || [];
        const allowed = roles.includes('FACILITY_MANAGER') || roles.includes('ORG_ADMIN');
        setIsAllowed(allowed);
        if (!allowed) {
          router.push('/admin/dashboard');
          return;
        }
        await fetchProfile();
      } catch (err) {
        console.error('Init failed', err);
        router.push('/admin/dashboard');
      }
    }
    init();
  }, [router, fetchProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/users/${technicianId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name || null,
          email: email || null,
          phone: phone || '',
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          availabilityNote: availabilityNote || null,
          shiftStatus: shiftStatus || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save technician profile');
      }

      await fetchProfile();
    } catch (err) {
      console.error('Save failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save technician profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowed) return null;

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading technician...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div className="text-destructive text-sm">{error || 'Technician not found'}</div>
        <Button variant="outline" onClick={() => router.push('/admin/technicians')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Technician Profile</h1>
            <p className="text-muted-foreground">Manage contact, skills, and availability</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/technicians')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Directory
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact & Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email || ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skills">Skills (comma separated)</Label>
            <Input
              id="skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="HVAC, Electrical, Plumbing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="availability">Availability / Shift Note</Label>
            <Textarea
              id="availability"
              rows={3}
              value={availabilityNote}
              onChange={(e) => setAvailabilityNote(e.target.value)}
              placeholder="e.g., Day shift, on-call evenings"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shiftStatus">Shift Status</Label>
            <Input
              id="shiftStatus"
              value={shiftStatus}
              onChange={(e) => setShiftStatus(e.target.value)}
              placeholder="on_shift / off_shift"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={fetchProfile} disabled={saving}>
              Refresh
            </Button>
          </div>
          {error && <div className="text-destructive text-sm">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workload Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-2xl font-bold">{profile.workload?.active ?? 0}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground">In Progress</div>
            <div className="text-2xl font-bold">{profile.workload?.inProgress ?? 0}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold">{profile.workload?.completed ?? 0}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

