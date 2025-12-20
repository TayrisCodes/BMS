'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ArrowLeft, Archive, X } from 'lucide-react';
import { MessageThread } from '@/lib/components/messages/MessageThread';
import { MessageComposer } from '@/lib/components/messages/MessageComposer';
import { HelpIntegration } from '@/lib/components/messages/HelpIntegration';
import { apiGet, apiPatch } from '@/lib/utils/api-client';
import { useToast } from '@/lib/components/ui/use-toast';
import type { Conversation, Message } from '@/lib/types/conversation';

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const conversationId = params.id as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadConversation();
    // Set up polling to refresh messages
    const interval = setInterval(() => {
      loadMessages();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    // Get current user ID for message display
    async function getCurrentUser() {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.auth?.userId || data.user?._id || '');
        }
      } catch (error) {
        console.error('Failed to get current user:', error);
      }
    }
    getCurrentUser();
  }, []);

  const loadConversation = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ conversation: Conversation; messages: Message[] }>(
        `/api/conversations/${conversationId}`,
      );
      setConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load conversation',
        variant: 'destructive',
      });
      router.push('/tenant/messages');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await apiGet<{ messages: Message[] }>(
        `/api/conversations/${conversationId}/messages`,
      );
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to refresh messages:', error);
    }
  };

  const handleMessageSent = () => {
    loadMessages();
    loadConversation();
  };

  const handleArchive = async () => {
    try {
      await apiPatch(`/api/conversations/${conversationId}`, {
        status: 'archived',
      });
      toast({
        title: 'Success',
        description: 'Conversation archived',
      });
      router.push('/tenant/messages');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive conversation',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Conversation not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/tenant/messages')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{conversation.subject}</h1>
          {conversation.buildingManager && (
            <p className="text-muted-foreground">with {conversation.buildingManager.name}</p>
          )}
        </div>
        <Button variant="outline" onClick={handleArchive}>
          <Archive className="h-4 w-4 mr-2" />
          Archive
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-[calc(100vh-200px)]">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">{conversation.subject}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <MessageThread messages={messages} currentUserId={currentUserId} />
              <MessageComposer conversationId={conversationId} onMessageSent={handleMessageSent} />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <HelpIntegration conversationSubject={conversation.subject} />
        </div>
      </div>
    </div>
  );
}
