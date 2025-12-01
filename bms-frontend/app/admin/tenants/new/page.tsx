'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
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
import { apiPost } from '@/lib/utils/api-client';
import { ArrowLeft, Users } from 'lucide-react';

export default function NewTenantPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    const tenantData = {
      firstName: formData.get('firstName')?.toString() || '',
      lastName: formData.get('lastName')?.toString() || '',
      primaryPhone: formData.get('primaryPhone')?.toString() || '',
      email: formData.get('email')?.toString() || null,
      nationalId: formData.get('nationalId')?.toString() || null,
      language: formData.get('language')?.toString() || null,
      emergencyContact: {
        name: formData.get('emergencyName')?.toString() || '',
        phone: formData.get('emergencyPhone')?.toString() || '',
      },
      notes: formData.get('notes')?.toString() || null,
    };

    try {
      const result = await apiPost<{ tenant: { _id: string } }>('/api/tenants', tenantData);
      router.push(`/admin/tenants/${result.tenant._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/tenants">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Create New Tenant</CardTitle>
              <CardDescription>Add a new tenant to the system</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" name="firstName" required placeholder="First name" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" name="lastName" required placeholder="Last name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryPhone">Phone Number *</Label>
                  <Input
                    id="primaryPhone"
                    name="primaryPhone"
                    required
                    placeholder="+251 9XX XXX XXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="email@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nationalId">National ID</Label>
                  <Input id="nationalId" name="nationalId" placeholder="National ID number" />
                </div>
                <div>
                  <Label htmlFor="language">Preferred Language</Label>
                  <Select name="language">
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="am">Amharic</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="om">Afaan Oromo</SelectItem>
                      <SelectItem value="ti">Tigrigna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Emergency Contact</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="emergencyName" className="text-xs">
                      Name
                    </Label>
                    <Input
                      id="emergencyName"
                      name="emergencyName"
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone" className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id="emergencyPhone"
                      name="emergencyPhone"
                      placeholder="Emergency contact phone"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes about the tenant"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/admin/tenants">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Tenant'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
