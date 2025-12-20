import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findWorkOrderById, updateWorkOrder } from '@/lib/work-orders/work-orders';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILES = 10;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/work-orders/[id]/photos
 * Upload photos for a work order.
 * Requires work_orders.update permission.
 */
export async function POST(request: NextRequest, routeParams: RouteParams) {
  try {
    const context = await getAuthContextFromCookies();
    const { id } = await routeParams.params;

    if (!context) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Require permission to update work orders
    requirePermission(context, 'maintenance', 'update');

    const organizationId = context.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 403 });
    }

    // Get work order
    const workOrder = await findWorkOrderById(id, organizationId);
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    validateOrganizationAccess(context, workOrder.organizationId);

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
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'work-orders');

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
          { error: `File ${file.name} exceeds maximum size of 5MB` },
          { status: 400 },
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const extension = file.name.split('.').pop() || 'jpg';
      const filename = `${timestamp}-${randomStr}.${extension}`;
      const filepath = join(uploadDir, filename);

      // Convert file to buffer and save
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      // Generate URL (relative to public directory)
      const url = `/uploads/work-orders/${filename}`;
      uploadedUrls.push(url);
    }

    // Update work order with new photo URLs
    const existingPhotos = workOrder.photos || [];
    const updatedPhotos = [...existingPhotos, ...uploadedUrls];

    await updateWorkOrder(id, {
      photos: updatedPhotos,
    });

    return NextResponse.json({
      message: 'Photos uploaded successfully',
      urls: uploadedUrls,
      count: uploadedUrls.length,
      totalPhotos: updatedPhotos.length,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Authentication required')) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Invalid') || error.message.includes('exceeds')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to upload photos. Please try again.' },
      { status: 500 },
    );
  }
}
