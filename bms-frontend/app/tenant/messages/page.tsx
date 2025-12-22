'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Plus, MessageSquare } from 'lucide-react';
import { ConversationList } from '@/lib/components/messages/ConversationList';
import { NewConversationDialog } from '@/lib/components/messages/NewConversationDialog';
import { apiGet } from '@/lib/utils/api-client';
import type { Conversation } from '@/lib/types/conversation';

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConversationOpen, setNewConversationOpen] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ conversations: Conversation[] }>(
        '/api/conversations?status=active',
      );
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/tenant/messages/${conversationId}`);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communicate with your building manager</p>
        </div>
        <Button onClick={() => setNewConversationOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
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
            <ConversationList conversations={conversations} basePath="/tenant/messages" />
          )}
        </CardContent>
      </Card>

      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={(open) => {
          setNewConversationOpen(open);
          if (!open) {
            loadConversations();
          }
        }}
      />
    </div>
  );
}
