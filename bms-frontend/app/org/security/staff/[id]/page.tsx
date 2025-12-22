'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Badge } from '@/lib/components/ui/badge';
import { apiGet, apiPut } from '@/lib/utils/api-client';
import { ArrowLeft, Shield, Edit, Save } from 'lucide-react';
import Link from 'next/link';

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

interface Building {
  _id: string;
  name: string;
}

export default function SecurityStaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [staff, setStaff] = useState<SecurityStaff | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    buildingId: '',
    employeeId: '',
    badgeNumber: '',
    hireDate: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    notes: '',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [staffData, buildingsData] = await Promise.all([
          apiGet<SecurityStaff>(`/api/security/staff/${id}`),
          apiGet<{ buildings: Building[] }>('/api/buildings'),
        ]);

        setStaff(staffData);
        setBuildings(buildingsData.buildings || []);

        if (staffData) {
          setFormData({
            buildingId: staffData.buildingId || '',
            employeeId: staffData.employeeId || '',
            badgeNumber: staffData.badgeNumber || '',
            hireDate: staffData.hireDate ? staffData.hireDate.split('T')[0] : '',
            emergencyContactName: staffData.emergencyContact?.name || '',
            emergencyContactPhone: staffData.emergencyContact?.phone || '',
            emergencyContactRelationship: staffData.emergencyContact?.relationship || '',
            notes: staffData.notes || '',
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load security staff');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchData();
    }
  }, [id]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        buildingId: formData.buildingId || null,
        employeeId: formData.employeeId || null,
        badgeNumber: formData.badgeNumber || null,
        hireDate: formData.hireDate || null,
        emergencyContact: formData.emergencyContactName
          ? {
              name: formData.emergencyContactName,
              phone: formData.emergencyContactPhone,
              relationship: formData.emergencyContactRelationship || null,
            }
          : null,
        notes: formData.notes || null,
      };

      const updated = await apiPut<SecurityStaff>(`/api/security/staff/${id}`, payload);
      setStaff(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update security staff');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="container mx-auto py-6">
        <p>Security staff not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/security/staff">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Security Staff Profile</h1>
          <p className="text-muted-foreground">View and edit security staff information</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              {isEditing ? (
                <Input
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              ) : (
                <p className="text-sm">{staff.employeeId || 'N/A'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Badge Number</Label>
              {isEditing ? (
                <Input
                  value={formData.badgeNumber}
                  onChange={(e) => setFormData({ ...formData, badgeNumber: e.target.value })}
                />
              ) : (
                <p className="text-sm">{staff.badgeNumber || 'N/A'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Primary Building</Label>
              {isEditing ? (
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) => setFormData({ ...formData, buildingId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {buildings.map((building) => (
                      <SelectItem key={building._id} value={building._id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">
                  {staff.buildingId ? (
                    <Badge variant="outline">Building {staff.buildingId.slice(-6)}</Badge>
                  ) : (
                    'N/A'
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Hire Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                />
              ) : (
                <p className="text-sm">
                  {staff.hireDate ? new Date(staff.hireDate).toLocaleDateString() : 'N/A'}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Emergency Contact</Label>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Contact name"
                  value={formData.emergencyContactName}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyContactName: e.target.value })
                  }
                />
                <Input
                  placeholder="Phone number"
                  value={formData.emergencyContactPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyContactPhone: e.target.value })
                  }
                />
                <Input
                  placeholder="Relationship"
                  value={formData.emergencyContactRelationship}
                  onChange={(e) =>
                    setFormData({ ...formData, emergencyContactRelationship: e.target.value })
                  }
                />
              </div>
            ) : (
              <div className="text-sm">
                {staff.emergencyContact ? (
                  <div>
                    <p>
                      <strong>{staff.emergencyContact.name}</strong> -{' '}
                      {staff.emergencyContact.phone}
                    </p>
                    {staff.emergencyContact.relationship && (
                      <p className="text-muted-foreground">{staff.emergencyContact.relationship}</p>
                    )}
                  </div>
                ) : (
                  'N/A'
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Certifications</Label>
            {staff.certifications && staff.certifications.length > 0 ? (
              <div className="space-y-2">
                {staff.certifications.map((cert, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="secondary">{cert.name}</Badge>
                    {cert.issuer && (
                      <span className="text-sm text-muted-foreground">- {cert.issuer}</span>
                    )}
                    {cert.expiryDate && (
                      <span className="text-sm text-muted-foreground">
                        (Expires: {new Date(cert.expiryDate).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No certifications</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            {isEditing ? (
              <textarea
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{staff.notes || 'No notes'}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {isEditing && (
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
