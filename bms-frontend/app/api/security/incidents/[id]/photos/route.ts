import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { findIncidentById, addIncidentPhoto } from '@/lib/security/incidents';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILES = 10;

const ALLOWED_ROLES = ['ORG_ADMIN', 'BUILDING_MANAGER', 'SECURITY'];

/**
 * POST /api/security/incidents/[id]/photos
 * Upload photos for an incident.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthContextFromCookies();
    if (!context || !context.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission/role guard
    try {
      requirePermission(context, 'security', 'update');
    } catch {
      const hasRole = context.roles.some((r) => ALLOWED_ROLES.includes(r));
      if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { id } = await params;
    const incident = await findIncidentById(id, context.organizationId);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('photos') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} photos allowed` }, { status: 400 });
    }

    // Validate and process files
    const uploadedUrls: string[] = [];
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'incidents');

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only images are allowed.` },
          { status: 400 },
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 },
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const extension = file.name.split('.').pop();
      const filename = `${id}-${timestamp}-${randomStr}.${extension}`;
      const filepath = join(uploadDir, filename);

      // Write file
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      // Generate URL
      const url = `/uploads/incidents/${filename}`;
      uploadedUrls.push(url);
    }

    // Update incident with photo URLs
    for (const url of uploadedUrls) {
      await addIncidentPhoto(id, url, context.organizationId);
    }

    // Fetch updated incident
    const updatedIncident = await findIncidentById(id, context.organizationId);

    return NextResponse.json({
      photos: updatedIncident?.photos || [],
      message: `Successfully uploaded ${uploadedUrls.length} photo(s)`,
    });
  } catch (error) {
    console.error('Incident photo upload error:', error);
    return NextResponse.json({ error: 'Failed to upload photos' }, { status: 500 });
  }
}
