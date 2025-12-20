import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, type OptionalUnlessRequiredId } from 'mongodb';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { hasOrgRole } from '@/lib/auth/authz';
import { getConversationsCollection, getMessagesCollection } from '@/lib/db/conversations';
import { getDb } from '@/lib/db';
import type { SendMessageRequest } from '@/lib/types/conversation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]/messages
 * Get messages in conversation
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { id } = await params;
    const conversationId = new ObjectId(id);

    // Verify conversation exists and user has access
    const conversationsCollection = await getConversationsCollection();
    const conversation = await conversationsCollection.findOne({
      _id: conversationId,
      organizationId: context.organizationId,
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check access permissions
    if (context.roles.includes('TENANT')) {
      if (conversation.tenantId.toString() !== (context.tenantId || '')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (hasOrgRole(context, ['BUILDING_MANAGER'])) {
      if (conversation.buildingManagerId.toString() !== context.userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (!hasOrgRole(context, ['ORG_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get messages
    const messagesCollection = await getMessagesCollection();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    let messagesQuery: Record<string, unknown> = { conversationId };
    if (before) {
      messagesQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await messagesCollection
      .find(messagesQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Populate sender info
    const messagesWithSenders = await Promise.all(
      messages.map(async (msg) => {
        let sender: { name: string; email?: string; phone?: string } | null = null;

        if (msg.senderType === 'tenant') {
          const db = await getDb();
          const tenant = await db
            .collection('tenants')
            .findOne({ _id: new ObjectId(msg.senderId) });
          if (tenant) {
            sender = {
              name: `${tenant.firstName} ${tenant.lastName}`,
              email: tenant.email || undefined,
              phone: tenant.primaryPhone,
            };
          }
        } else {
          const db = await getDb();
          const user = await db.collection('users').findOne({ _id: new ObjectId(msg.senderId) });
          if (user) {
            sender = {
              name: user.name || user.email || 'Unknown',
              email: user.email || undefined,
              phone: user.phone,
            };
          }
        }

        return {
          ...msg,
          _id: msg._id.toString(),
          conversationId: msg.conversationId.toString(),
          senderId: msg.senderId.toString(),
          sender,
        };
      }),
    );

    return NextResponse.json({
      messages: messagesWithSenders.reverse(), // Reverse to show oldest first
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Send new message
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { id } = await params;
    const conversationId = new ObjectId(id);
    const body: SendMessageRequest = await request.json();
    const { content, attachments } = body;

    if ((!content || content.trim().length === 0) && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Message content or attachments are required' },
        { status: 400 },
      );
    }

    // Verify conversation exists and user has access
    const conversationsCollection = await getConversationsCollection();
    const conversation = await conversationsCollection.findOne({
      _id: conversationId,
      organizationId: context.organizationId,
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check access permissions
    if (context.roles.includes('TENANT')) {
      if (conversation.tenantId.toString() !== (context.tenantId || '')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (hasOrgRole(context, ['BUILDING_MANAGER'])) {
      if (conversation.buildingManagerId.toString() !== context.userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (!hasOrgRole(context, ['ORG_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine sender type and ID
    const senderType: 'tenant' | 'building_manager' | 'org_admin' = context.roles.includes('TENANT')
      ? 'tenant'
      : context.roles.includes('ORG_ADMIN')
        ? 'org_admin'
        : 'building_manager';
    const senderId =
      context.roles.includes('TENANT') && context.tenantId
        ? new ObjectId(context.tenantId)
        : new ObjectId(context.userId);

    // Create message
    const now = new Date();
    const messagesCollection = await getMessagesCollection();
    const message = {
      conversationId: new ObjectId(conversationId),
      senderId,
      senderType,
      content: content.trim(),
      attachments: attachments || [],
      createdAt: now,
    };

    const result = await messagesCollection.insertOne(message as OptionalUnlessRequiredId<any>);

    // Update conversation's lastMessageAt
    await conversationsCollection.updateOne(
      { _id: conversationId },
      { $set: { lastMessageAt: now, updatedAt: now } },
    );

    // Mark message as read for the sender (they just sent it)
    await messagesCollection.updateOne({ _id: result.insertedId }, { $set: { readAt: now } });

    // Create notification for recipient
    try {
      const { NotificationService } = await import('@/modules/notifications/notification-service');
      const notificationService = new NotificationService();

      // Determine recipient
      const recipientId =
        conversation.tenantId.toString() === senderId.toString()
          ? conversation.buildingManagerId.toString()
          : conversation.tenantId.toString();

      const recipientType =
        conversation.tenantId.toString() === senderId.toString() ? 'user' : 'tenant';

      // Get sender name
      let senderName = 'Someone';
      if (senderType === 'tenant') {
        const db = await getDb();
        const tenant = await db.collection('tenants').findOne({ _id: new ObjectId(senderId) });
        if (tenant) {
          senderName = `${tenant.firstName} ${tenant.lastName}`;
        }
      } else {
        const db = await getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(senderId) });
        if (user) {
          senderName = user.name || user.email || 'Building Manager';
        }
      }

      // Determine correct link based on recipient type
      const link =
        recipientType === 'tenant'
          ? `/tenant/messages/${conversationId}`
          : `/org/messages/${conversationId}`;

      await notificationService.createNotification({
        organizationId: context.organizationId,
        userId: recipientType === 'user' ? recipientId : null,
        tenantId: recipientType === 'tenant' ? recipientId : null,
        type: 'message_received',
        title: `New message from ${senderName}`,
        message:
          (content.trim() || 'Sent an attachment').substring(0, 100) +
          (content.length > 100 ? '...' : ''),
        channels: ['in_app', 'email'],
        link,
        metadata: {
          conversationId: conversationId.toString(),
          messageId: result.insertedId.toString(),
          senderId: senderId.toString(),
          senderType,
        },
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
      // Don't fail the message send if notification fails
    }

    // Get the created message with sender info
    const createdMessage = await messagesCollection.findOne({ _id: result.insertedId });

    // Populate sender info
    let sender: { name: string; email?: string; phone?: string } | null = null;
    if (senderType === 'tenant') {
      const db = await getDb();
      const tenant = await db.collection('tenants').findOne({ _id: new ObjectId(senderId) });
      if (tenant) {
        sender = {
          name: `${tenant.firstName} ${tenant.lastName}`,
          email: tenant.email || undefined,
          phone: tenant.primaryPhone,
        };
      }
    } else {
      const db = await getDb();
      const user = await db.collection('users').findOne({ _id: new ObjectId(senderId) });
      if (user) {
        sender = {
          name: user.name || user.email || 'Unknown',
          email: user.email || undefined,
          phone: user.phone,
        };
      }
    }

    return NextResponse.json(
      {
        message: {
          ...createdMessage,
          _id: createdMessage!._id.toString(),
          conversationId: createdMessage!.conversationId.toString(),
          senderId: createdMessage!.senderId.toString(),
          sender,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
