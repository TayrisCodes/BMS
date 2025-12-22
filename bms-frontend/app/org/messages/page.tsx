'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, MessageSquare, Search } from 'lucide-react';
import { ConversationList } from '@/lib/components/messages/ConversationList';
import { NewConversationDialog } from '@/lib/components/messages/NewConversationDialog';
import { apiGet } from '@/lib/utils/api-client';
import type { Conversation } from '@/lib/types/conversation';

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ conversations: Conversation[] }>(
        `/api/conversations?status=${statusFilter}`,
      );
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.subject.toLowerCase().includes(query) ||
      conv.tenant?.firstName?.toLowerCase().includes(query) ||
      conv.tenant?.lastName?.toLowerCase().includes(query) ||
      conv.buildingManager?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communicate with tenants</p>
        </div>
        <Button onClick={() => setNewConversationOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading conversations...</p>
            </div>
          ) : (
            <ConversationList conversations={filteredConversations} basePath="/org/messages" />
          )}
        </CardContent>
      </Card>

      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={(open) => {
          setNewConversationOpen(open);
          if (!open) {
            setSelectedTenantId('');
            loadConversations();
            // Remove tenantId from URL
            const url = new URL(window.location.href);
            url.searchParams.delete('tenantId');
            window.history.replaceState({}, '', url.toString());
          }
        }}
        {...(selectedTenantId ? { tenantId: selectedTenantId } : {})}
      />
    </div>
  );
}
