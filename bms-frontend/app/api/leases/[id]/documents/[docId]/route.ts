import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getAuthContextFromCookies } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/authz';
import { validateOrganizationAccess } from '@/lib/organizations/scoping';
import { findLeaseById } from '@/lib/leases/leases';
import { openGridFsDownloadStream } from '@/lib/files/gridfs';

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

export async function GET(request: Request, routeParams: RouteParams) {
  const context = await getAuthContextFromCookies();
  const { id, docId } = await routeParams.params;

  if (!context) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  requirePermission(context, 'leases', 'read');
  const lease = await findLeaseById(id, context.organizationId || undefined);
  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  validateOrganizationAccess(context, lease.organizationId);

  const doc = (lease.documents ?? []).find((d) => d._id === docId || d.gridFsId === docId);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    const stream = await openGridFsDownloadStream(doc.gridFsId);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
    return new Response(webStream, {
      headers: {
        'Content-Type': doc.contentType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to stream document', docId, error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
