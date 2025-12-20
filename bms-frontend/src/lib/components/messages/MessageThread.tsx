'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/lib/utils';
import { AttachmentViewer } from './AttachmentViewer';
import type { Message } from '@/lib/types/conversation';

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
}

export function MessageThread({ messages, currentUserId, isLoading }: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        const isOwnMessage = message.senderId === currentUserId;
        return (
          <div
            key={message._id}
            className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[70%] rounded-lg px-4 py-2',
                isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
              )}
            >
              {!isOwnMessage && message.sender && (
                <div className="text-xs font-semibold mb-1 opacity-80">{message.sender.name}</div>
              )}
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
              {message.attachments && message.attachments.length > 0 && (
                <AttachmentViewer attachments={message.attachments} />
              )}
              <div className="flex items-center gap-2 text-xs opacity-70 mt-1">
                <span>{format(new Date(message.createdAt), 'MMM d, h:mm a')}</span>
                {isOwnMessage && message.readAt && (
                  <span
                    className="text-primary"
                    title={`Read at ${format(new Date(message.readAt), 'MMM d, h:mm a')}`}
                  >
                    ✓✓
                  </span>
                )}
                {isOwnMessage && !message.readAt && (
                  <span className="opacity-50" title="Sent">
                    ✓
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
