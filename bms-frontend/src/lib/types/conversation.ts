export type ConversationStatus = 'active' | 'archived' | 'closed';

export type SenderType = 'tenant' | 'building_manager' | 'org_admin';

export interface Conversation {
  _id: string;
  organizationId: string;
  buildingId?: string;
  tenantId: string;
  buildingManagerId: string;
  subject: string;
  status: ConversationStatus;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  tenant?: {
    firstName: string;
    lastName: string;
    primaryPhone?: string;
    email?: string;
  };
  buildingManager?: {
    name: string;
    email?: string;
    phone?: string;
  };
  building?: {
    name: string;
    address?: string;
  };
  unreadCount?: number;
  lastMessage?: {
    content: string;
    senderType: SenderType;
    createdAt: Date;
  };
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderType: SenderType;
  content: string;
  attachments?: Array<{
    url: string;
    filename: string;
    type: string;
  }>;
  readAt?: Date;
  createdAt: Date;
  // Populated fields
  sender?: {
    name: string;
    email?: string;
    phone?: string;
  };
}

export interface CreateConversationRequest {
  tenantId: string;
  buildingManagerId?: string;
  buildingId?: string;
  subject: string;
  initialMessage: string;
}

export interface SendMessageRequest {
  content: string;
  attachments?: Array<{
    url: string;
    filename: string;
    type: string;
  }>;
}

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  subject?: string;
}
