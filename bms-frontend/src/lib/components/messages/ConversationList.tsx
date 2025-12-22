'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/lib/utils';
import { Badge } from '@/lib/components/ui/badge';
import type { Conversation } from '@/lib/types/conversation';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  basePath?: string;
}

export function ConversationList({
  conversations,
  currentConversationId,
  basePath = '/tenant/messages',
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conversation) => {
        const isActive = conversation._id === currentConversationId;
        const hasUnread = (conversation.unreadCount || 0) > 0;

        return (
          <Link
            key={conversation._id}
            href={`${basePath}/${conversation._id}`}
            className={cn(
              'block p-4 rounded-lg border transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent',
              hasUnread && !isActive && 'border-l-4 border-l-primary',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{conversation.subject}</h3>
                  {hasUnread && (
                    <Badge variant="secondary" className="text-xs">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
                {conversation.lastMessage && (
                  <p
                    className={cn(
                      'text-sm truncate',
                      isActive ? 'opacity-90' : 'text-muted-foreground',
                    )}
                  >
                    {conversation.lastMessage.content}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {conversation.buildingManager && (
                    <span className="text-xs opacity-70">{conversation.buildingManager.name}</span>
                  )}
                  {conversation.lastMessageAt && (
                    <span className="text-xs opacity-70">
                      {format(new Date(conversation.lastMessageAt), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
