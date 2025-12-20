import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findParkingViolationById, updateParkingViolation } from '@/lib/parking/parking-violations';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILES = 10;

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/parking/violations/[id]/photos
 * Uploads photos for a parking violation.
 * Requires parking.update permission.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    requirePermission(context, 'parking', 'update');
    validateOrganizationAccess(context);

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    const violation = await findParkingViolationById(params.id, organizationId);
    if (!violation) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll('photos') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} photos allowed` }, { status: 400 });
    }

    const uploadedUrls: string[] = violation.photos || [];
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'parking-violations');

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only images are allowed.` },
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

      uploadedUrls.push(`/uploads/parking-violations/${filename}`);
    }

    const updatedViolation = await updateParkingViolation(params.id, organizationId, {
      photos: uploadedUrls,
    });

    if (!updatedViolation) {
      return NextResponse.json(
        { error: 'Failed to update violation with photos' },
        { status: 500 },
      );
    }

    return NextResponse.json({ violation: updatedViolation });
  } catch (error) {
    console.error('Failed to upload violation photos:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

