import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { hasOrgRole } from '@/lib/auth/authz';
import { getConversationsCollection } from '@/lib/db/conversations';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_FILES = 5;

/**
 * POST /api/conversations/[id]/messages/attachments
 * Upload file attachments for a message
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

    // Verify conversation exists and user has access
    const conversationsCollection = await getConversationsCollection();
    const conversation = await conversationsCollection.findOne({
      _id: conversationId,
      organizationId: new ObjectId(context.organizationId),
    } as any);

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

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed per message` },
        { status: 400 },
      );
    }

    // Validate and process files
    const uploadedAttachments: Array<{
      url: string;
      filename: string;
      type: string;
      size: number;
    }> = [];
    const uploadDir = join(
      process.cwd(),
      'public',
      'uploads',
      'messages',
      conversationId.toString(),
    );

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed types: images and documents.` },
          { status: 400 },
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum size of 10MB` },
          { status: 400 },
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const extension = file.name.split('.').pop() || 'bin';
      const filename = `${timestamp}-${randomStr}.${extension}`;
      const filepath = join(uploadDir, filename);

      // Convert file to buffer and save
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      // Generate URL (relative to public directory)
      const url = `/uploads/messages/${conversationId.toString()}/${filename}`;
      uploadedAttachments.push({
        url,
        filename: file.name,
        type: file.type,
        size: file.size,
      });
    }

    return NextResponse.json({
      message: 'Files uploaded successfully',
      attachments: uploadedAttachments,
    });
  } catch (error) {
    console.error('Attachment upload error:', error);
    return NextResponse.json({ error: 'Failed to upload attachments' }, { status: 500 });
  }
}
