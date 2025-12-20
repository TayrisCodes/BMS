import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { hasOrgRole } from '@/lib/auth/authz';
import { getConversationsCollection, getMessagesCollection } from '@/lib/db/conversations';
import { getDb } from '@/lib/db';
import type { UpdateConversationRequest } from '@/lib/types/conversation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]
 * Get conversation with messages
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

    // Mark messages as read for the current user
    const currentUserId =
      context.roles.includes('TENANT') && context.tenantId
        ? new ObjectId(context.tenantId)
        : new ObjectId(context.userId);

    const now = new Date();
    const unreadMessages = messages.filter(
      (msg) => msg.senderId.toString() !== currentUserId.toString() && !msg.readAt,
    );

    if (unreadMessages.length > 0) {
      await messagesCollection.updateMany(
        {
          _id: { $in: unreadMessages.map((m) => m._id) },
        },
        {
          $set: { readAt: now },
        },
      );
    }

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

    // Populate conversation details
    const db = await getDb();
    const tenant = await db.collection('tenants').findOne({ _id: conversation.tenantId });

    const buildingManager = await db
      .collection('users')
      .findOne({ _id: conversation.buildingManagerId });

    const building = conversation.buildingId
      ? await db.collection('buildings').findOne({ _id: conversation.buildingId })
      : null;

    return NextResponse.json({
      conversation: {
        ...conversation,
        _id: conversation._id.toString(),
        tenantId: conversation.tenantId.toString(),
        buildingManagerId: conversation.buildingManagerId.toString(),
        organizationId: conversation.organizationId.toString(),
        buildingId: conversation.buildingId?.toString(),
        tenant: tenant
          ? {
              firstName: tenant.firstName,
              lastName: tenant.lastName,
              primaryPhone: tenant.primaryPhone,
              email: tenant.email,
            }
          : null,
        buildingManager: buildingManager
          ? {
              name: buildingManager.name || buildingManager.email || 'Unknown',
              email: buildingManager.email,
              phone: buildingManager.phone,
            }
          : null,
        building: building
          ? {
              name: building.name,
              address: building.address,
            }
          : null,
      },
      messages: messagesWithSenders.reverse(), // Reverse to show oldest first
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation (status, archive)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const body: UpdateConversationRequest = await request.json();

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

    // Update conversation
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.status) {
      update.status = body.status;
    }

    if (body.subject) {
      update.subject = body.subject;
    }

    await conversationsCollection.updateOne({ _id: conversationId }, { $set: update });

    const updatedConversation = await conversationsCollection.findOne({ _id: conversationId });

    return NextResponse.json({
      conversation: {
        ...updatedConversation,
        _id: updatedConversation!._id.toString(),
        tenantId: updatedConversation!.tenantId.toString(),
        buildingManagerId: updatedConversation!.buildingManagerId.toString(),
        organizationId: updatedConversation!.organizationId.toString(),
        buildingId: updatedConversation!.buildingId?.toString(),
      },
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id]
 * Soft delete conversation (mark as deleted)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    // Soft delete by setting status to 'closed'
    await conversationsCollection.updateOne(
      { _id: conversationId },
      { $set: { status: 'closed', updatedAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
