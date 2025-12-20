import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, type OptionalUnlessRequiredId } from 'mongodb';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { hasOrgRole, requirePermission } from '@/lib/auth/authz';
import { withOrganizationScope } from '@/lib/organizations/scoping';
import { getConversationsCollection, getMessagesCollection } from '@/lib/db/conversations';
import { getDb } from '@/lib/db';
import type { CreateConversationRequest } from '@/lib/types/conversation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * List conversations for the current user (filtered by role)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const buildingId = searchParams.get('buildingId');

    const conversationsCollection = await getConversationsCollection();
    const messagesCollection = await getMessagesCollection();

    // Build query based on user role
    let query: Record<string, unknown> = {
      organizationId: new ObjectId(context.organizationId),
      status: status,
    };

    if (context.roles.includes('TENANT')) {
      // Tenants can only see their own conversations
      const db = await getDb();
      const tenant = await db.collection('tenants').findOne({
        _id: new ObjectId(context.tenantId || ''),
        organizationId: new ObjectId(context.organizationId),
      });

      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }

      query.tenantId = new ObjectId(context.tenantId || '');
    } else if (hasOrgRole(context, ['BUILDING_MANAGER', 'ORG_ADMIN'])) {
      // Building managers can see conversations with tenants in their buildings
      if (context.roles.includes('BUILDING_MANAGER')) {
        // Get buildings assigned to this building manager
        const db = await getDb();
        const user = await db.collection('users').findOne({
          _id: new ObjectId(context.userId),
          organizationId: new ObjectId(context.organizationId),
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // For now, building managers can see all conversations in their organization
        // In the future, we can filter by assigned buildings
        query.buildingManagerId = new ObjectId(context.userId);
      }
      // ORG_ADMIN can see all conversations in their organization (no additional filter)
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (buildingId) {
      query.buildingId = new ObjectId(buildingId);
    }

    const conversations = await conversationsCollection
      .find(query)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .toArray();

    // Get unread counts and last message for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await messagesCollection.findOne(
          { conversationId: conv._id.toString() },
          { sort: { createdAt: -1 } },
        );

        // Count unread messages (messages not read by current user)
        const currentUserId = context.userId;
        const unreadCount = await messagesCollection.countDocuments({
          conversationId: conv._id.toString(),
          senderId: { $ne: currentUserId },
          readAt: { $exists: false },
        });

        // Populate tenant and building manager info
        const db = await getDb();
        const tenant = await db.collection('tenants').findOne({ _id: conv.tenantId });

        const buildingManager = await db
          .collection('users')
          .findOne({ _id: conv.buildingManagerId });

        const building = conv.buildingId
          ? await db.collection('buildings').findOne({ _id: conv.buildingId })
          : null;

        return {
          ...conv,
          _id: conv._id.toString(),
          tenantId: conv.tenantId.toString(),
          buildingManagerId: conv.buildingManagerId.toString(),
          organizationId: conv.organizationId.toString(),
          buildingId: conv.buildingId?.toString(),
          unreadCount,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                senderType: lastMessage.senderType,
                createdAt: lastMessage.createdAt,
              }
            : null,
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
        };
      }),
    );

    return NextResponse.json({ conversations: conversationsWithDetails });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!context.organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body: CreateConversationRequest = await request.json();
    const { tenantId, buildingManagerId, buildingId, subject, initialMessage } = body;

    if (!subject || !initialMessage) {
      return NextResponse.json(
        { error: 'Subject and initial message are required' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const conversationsCollection = await getConversationsCollection();
    const messagesCollection = await getMessagesCollection();

    // Validate tenant exists and belongs to organization
    const tenant = await db.collection('tenants').findOne({
      _id: new ObjectId(tenantId),
      organizationId: new ObjectId(context.organizationId),
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Determine building manager
    let finalBuildingManagerId: ObjectId;
    if (buildingManagerId) {
      // Validate building manager exists and has BUILDING_MANAGER role
      const buildingManager = await db.collection('users').findOne({
        _id: new ObjectId(buildingManagerId),
        organizationId: new ObjectId(context.organizationId),
        roles: 'BUILDING_MANAGER',
      });

      if (!buildingManager) {
        return NextResponse.json(
          { error: 'Building manager not found or invalid role' },
          { status: 404 },
        );
      }

      finalBuildingManagerId = new ObjectId(buildingManagerId);
    } else {
      // If not specified, use the current user (must be a building manager)
      if (!hasOrgRole(context, ['BUILDING_MANAGER', 'ORG_ADMIN'])) {
        return NextResponse.json({ error: 'Building manager ID required' }, { status: 400 });
      }
      finalBuildingManagerId = new ObjectId(context.userId);
    }

    // Determine sender type
    const senderType = context.roles.includes('TENANT')
      ? 'tenant'
      : context.roles.includes('ORG_ADMIN')
        ? 'org_admin'
        : 'building_manager';
    const senderId =
      context.roles.includes('TENANT') && context.tenantId
        ? new ObjectId(context.tenantId)
        : new ObjectId(context.userId);

    // Create conversation
    const now = new Date();
    const conversation = {
      organizationId: new ObjectId(context.organizationId),
      buildingId: buildingId ? new ObjectId(buildingId) : undefined,
      tenantId: new ObjectId(tenantId),
      buildingManagerId: finalBuildingManagerId,
      subject,
      status: 'active' as const,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await conversationsCollection.insertOne(conversation);
    const conversationId = result.insertedId;

    // Create initial message
    const message = {
      conversationId,
      senderId,
      senderType,
      content: initialMessage,
      createdAt: now,
    };

    await messagesCollection.insertOne(message as OptionalUnlessRequiredId<any>);

    // Return created conversation with details
    const createdConversation = await conversationsCollection.findOne({ _id: conversationId });
    if (!createdConversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    return NextResponse.json(
      {
        conversation: {
          ...createdConversation,
          _id: createdConversation._id.toString(),
          tenantId: createdConversation.tenantId.toString(),
          buildingManagerId: createdConversation.buildingManagerId.toString(),
          organizationId: createdConversation.organizationId.toString(),
          buildingId: createdConversation.buildingId?.toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
