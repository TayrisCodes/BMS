import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findNoticeById, updateNotice } from '@/lib/notices/notices';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/notices/[id]/attachments
 * Uploads attachments for a notice.
 * Requires notices.update permission.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    requirePermission(context, 'notices', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const notice = await findNoticeById(params.id, organizationId);
    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }
    validateOrganizationAccess(context, notice.organizationId);

    const formData = await request.formData();
    const files = formData.getAll('attachments') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedUrls: string[] = notice.attachments || [];
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'notices');

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed types: images, PDF, Word documents.` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
          { status: 400 },
        );
      }

      const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const filepath = join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);

      uploadedUrls.push(`/uploads/notices/${filename}`);
    }

    const updatedNotice = await updateNotice(params.id, organizationId, {
      attachments: uploadedUrls,
    });

    if (!updatedNotice) {
      return NextResponse.json(
        { error: 'Failed to update notice with attachments' },
        { status: 500 },
      );
    }

    return NextResponse.json({ notice: updatedNotice });
  } catch (error) {
    console.error('Failed to upload notice attachments:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
