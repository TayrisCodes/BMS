'use client';

import { useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Textarea } from '@/lib/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/utils/api-client';
import { useToast } from '@/lib/components/ui/use-toast';
import { AttachmentUpload } from './AttachmentUpload';
import type { Message } from '@/lib/types/conversation';

interface MessageComposerProps {
  conversationId: string;
  onMessageSent?: () => void;
}

export function MessageComposer({ conversationId, onMessageSent }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{ url: string; filename: string; type: string }>
  >([]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && attachments.length === 0) || sending) return;

    setSending(true);
    try {
      await apiPost(`/api/conversations/${conversationId}/messages`, {
        content: content.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setContent('');
      setAttachments([]);
      onMessageSent?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4 space-y-2">
      <AttachmentUpload
        conversationId={conversationId}
        onAttachmentsUploaded={(attached) => {
          setAttachments(attached);
        }}
      />
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          className="min-h-[80px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
        />
        <Button
          type="submit"
          disabled={(!content.trim() && attachments.length === 0) || sending}
          size="icon"
          className="self-end"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Press Cmd/Ctrl + Enter to send</p>
    </form>
  );
}
