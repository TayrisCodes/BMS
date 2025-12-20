'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Loader2, UserPlus, CheckCircle2, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { useToast } from '@/lib/components/ui/use-toast';
import { CSVImportDialog } from '@/components/users/CSVImportDialog';
import { HelpIcon } from '@/lib/components/ui/help-icon';
import type { UserRole } from '@/lib/auth/types';
import type { OnboardingTemplate } from '@/app/api/users/onboarding/templates/route';

interface OnboardingUser {
  email?: string;
  phone: string;
  name?: string;
  roles: UserRole[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    successful: number;
    failed: number;
  } | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await apiGet<{ templates: OnboardingTemplate[] }>(
          '/api/users/onboarding/templates',
        );
        setTemplates(data.templates || []);
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    }
    loadTemplates();
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // Initialize users with template roles
      setUsers([
        {
          email: '',
          phone: '',
          name: '',
          roles: template.roles,
        },
      ]);
    }
  };

  const handleAddUser = () => {
    const template = templates.find((t) => t.id === selectedTemplate);
    setUsers([
      ...users,
      {
        email: '',
        phone: '',
        name: '',
        roles: template?.roles || [],
      },
    ]);
  };

  const handleUserChange = (index: number, field: keyof OnboardingUser, value: string) => {
    const newUsers = [...users];
    if (field === 'roles') {
      // For now, keep template roles
      return;
    }
    (newUsers[index] as any)[field] = value;
    setUsers(newUsers);
  };

  const handleInvite = async () => {
    if (users.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one user is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate users
    const invalidUsers = users.filter((u) => !u.phone.trim());
    if (invalidUsers.length > 0) {
      toast({
        title: 'Error',
        description: 'All users must have a phone number',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    setResults(null);

    try {
      const response = await fetch('/api/users/bulk/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: users.map((u) => ({
            email: u.email?.trim() || undefined,
            phone: u.phone.trim(),
            name: u.name?.trim() || undefined,
            roles: u.roles,
          })),
          createType: 'invite',
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResults({
          total: data.total,
          successful: data.successful,
          failed: data.failed,
        });
        setStep(4); // Go to results step
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to invite users',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Invite error:', error);
      toast({
        title: 'Error',
        description: 'Failed to invite users',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCSVImportSuccess = () => {
    setCsvImportOpen(false);
    toast({
      title: 'Success',
      description: 'Users imported successfully. Check the users list.',
    });
    router.push('/admin/users');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">User Onboarding</h1>
          <p className="text-muted-foreground">
            Streamlined workflow to onboard new users to your organization
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between max-w-2xl mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step >= s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-muted'
                }`}
              >
                {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              {s < 4 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between max-w-2xl text-xs text-muted-foreground">
          <span>Template</span>
          <span>Details</span>
          <span>Review</span>
          <span>Results</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Step 1: Select Template'}
            {step === 2 && 'Step 2: Enter User Details'}
            {step === 3 && 'Step 3: Review & Confirm'}
            {step === 4 && 'Step 4: Results'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label>Select Onboarding Template</Label>
                  <HelpIcon content="Templates define default roles for users. Select a template that matches the type of users you're onboarding." />
                </div>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} - {template.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-semibold mb-2">
                    {templates.find((t) => t.id === selectedTemplate)?.name}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {templates.find((t) => t.id === selectedTemplate)?.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Roles:{' '}
                    {templates
                      .find((t) => t.id === selectedTemplate)
                      ?.roles.map((r) => r.replace(/_/g, ' '))
                      .join(', ')}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setStep(2)} disabled={!selectedTemplate} className="flex-1">
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                  Or Import from CSV
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>User Details</Label>
                <Button variant="outline" size="sm" onClick={handleAddUser}>
                  Add User
                </Button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {users.map((user, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Name (Optional)</Label>
                        <Input
                          value={user.name || ''}
                          onChange={(e) => handleUserChange(index, 'name', e.target.value)}
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={user.email || ''}
                          onChange={(e) => handleUserChange(index, 'email', e.target.value)}
                          placeholder="user@example.com"
                          required
                        />
                      </div>
                      <div>
                        <Label>Phone *</Label>
                        <Input
                          value={user.phone}
                          onChange={(e) => handleUserChange(index, 'phone', e.target.value)}
                          placeholder="+251911000000"
                          required
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Roles: {user.roles.map((r) => r.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1" disabled={users.length === 0}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Review Before Sending
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  You are about to invite {users.length} user(s). They will receive an email with
                  activation instructions.
                </p>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {users.map((user, index) => (
                  <div key={index} className="border rounded p-2 text-sm">
                    <p className="font-medium">
                      {user.name || user.email || user.phone} ({user.phone})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Roles: {user.roles.map((r) => r.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleInvite} disabled={saving} className="flex-1">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Invitations...
                    </>
                  ) : (
                    <>Send Invitations ({users.length})</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{results.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/admin/users')}>
                  View Users
                </Button>
                <Button
                  onClick={() => {
                    setStep(1);
                    setResults(null);
                    setUsers([]);
                    setSelectedTemplate('');
                  }}
                >
                  Start New Onboarding
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onSuccess={handleCSVImportSuccess}
      />
    </div>
  );
}
