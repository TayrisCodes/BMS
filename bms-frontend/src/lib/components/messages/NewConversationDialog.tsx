'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
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
import { Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { useToast } from '@/lib/components/ui/use-toast';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  buildingManagerId?: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  tenantId,
  buildingManagerId,
}: NewConversationDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId || '');
  const [selectedBuildingManagerId, setSelectedBuildingManagerId] = useState(
    buildingManagerId || '',
  );
  const [tenants, setTenants] = useState<
    Array<{ _id: string; firstName: string; lastName: string }>
  >([]);
  const [buildingManagers, setBuildingManagers] = useState<
    Array<{ _id: string; name: string; email?: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject('');
      setMessage('');
      setSelectedTenantId(tenantId || '');
      setSelectedBuildingManagerId(buildingManagerId || '');
      loadOptions();
    }
  }, [open, tenantId, buildingManagerId]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      // Load tenants if needed (for building managers)
      const tenantsData = await apiGet<{
        tenants: Array<{ _id: string; firstName: string; lastName: string }>;
      }>('/api/tenants');
      setTenants(tenantsData.tenants || []);

      // Load building managers if needed (for tenants)
      const usersData = await apiGet<{
        users: Array<{ _id: string; name: string; email?: string }>;
      }>('/api/users?role=BUILDING_MANAGER');
      setBuildingManagers(usersData.users || []);
    } catch (error) {
      console.error('Failed to load options:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({
        title: 'Error',
        description: 'Subject and message are required',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTenantId) {
      toast({
        title: 'Error',
        description: 'Please select a tenant',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const data = await apiPost<{ conversation: { _id: string } }>('/api/conversations', {
        tenantId: selectedTenantId,
        buildingManagerId: selectedBuildingManagerId || undefined,
        subject: subject.trim(),
        initialMessage: message.trim(),
      });

      toast({
        title: 'Success',
        description: 'Conversation created successfully',
      });

      onOpenChange(false);
      router.push(`/tenant/messages/${data.conversation._id}`);
      router.refresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>Start a new conversation with a building manager</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!tenantId && (
            <div>
              <Label htmlFor="tenant">Tenant *</Label>
              <Select
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
                disabled={loadingOptions}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant._id} value={tenant._id}>
                      {tenant.firstName} {tenant.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!buildingManagerId && buildingManagers.length > 0 && (
            <div>
              <Label htmlFor="buildingManager">Building Manager</Label>
              <Select
                value={selectedBuildingManagerId}
                onValueChange={setSelectedBuildingManagerId}
                disabled={loadingOptions}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select building manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {buildingManagers.map((bm) => (
                    <SelectItem key={bm._id} value={bm._id}>
                      {bm.name || bm.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Conversation subject"
              required
            />
          </div>

          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Conversation'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
