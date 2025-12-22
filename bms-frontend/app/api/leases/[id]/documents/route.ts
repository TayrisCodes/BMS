import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findLeaseById, updateLease } from '@/lib/leases/leases';
import { saveBufferToGridFS } from '@/lib/files/gridfs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request, routeParams: RouteParams) {
  const context = await getAuthContextFromCookies();
  const { id } = await routeParams.params;

  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  requirePermission(context, 'leases', 'update');

  const lease = await findLeaseById(id, context.organizationId || undefined);
  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  validateOrganizationAccess(context, lease.organizationId);

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const buffer = Buffer.from(arrayBuffer);
  const stored = await saveBufferToGridFS(buffer, file.name, file.type || undefined);

  const newDoc = {
    _id: stored.id,
    filename: stored.filename,
    size: stored.length,
    contentType: stored.contentType ?? file.type ?? 'application/octet-stream',
    gridFsId: stored.id,
    uploadedBy: context.userId || 'system',
    uploadedAt: new Date(),
  };

  await updateLease(id, {
    documents: [...(lease.documents ?? []), newDoc],
  });

  return NextResponse.json({
    message: 'Document uploaded',
    document: newDoc,
  });
}

export async function GET(request: Request, routeParams: RouteParams) {
  const context = await getAuthContextFromCookies();
  const { id } = await routeParams.params;

  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  requirePermission(context, 'leases', 'read');
  const lease = await findLeaseById(id, context.organizationId || undefined);
  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  validateOrganizationAccess(context, lease.organizationId);

  const docs = lease.documents ?? [];
  return NextResponse.json({ documents: docs, count: docs.length });
}
