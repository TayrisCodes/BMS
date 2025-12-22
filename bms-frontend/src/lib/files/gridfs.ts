import { ObjectId, GridFSBucket } from 'mongodb';
import { getDb } from '@/lib/db';

export interface StoredFile {
  id: string;
  filename: string;
  length: number;
  uploadDate: Date;
  contentType?: string;
}

async function getBucket(): Promise<GridFSBucket> {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: 'uploads' });
}

export async function saveBufferToGridFS(
  buffer: Buffer,
  filename: string,
  contentType?: string,
): Promise<StoredFile> {
  const bucket = await getBucket();
  const uploadStream = bucket.openUploadStream(filename);

  await new Promise<void>((resolve, reject) => {
    uploadStream.on('error', reject);
    uploadStream.on('finish', resolve);
    uploadStream.end(buffer);
  });

  return {
    id: uploadStream.id.toString(),
    filename,
    length: uploadStream.length ?? buffer.length,
    uploadDate: new Date(),
    ...(contentType ? { contentType } : {}),
  };
}

export async function openGridFsDownloadStream(fileId: string) {
  const bucket = await getBucket();
  const objectId = new ObjectId(fileId);
  return bucket.openDownloadStream(objectId);
}
