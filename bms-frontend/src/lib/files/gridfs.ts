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
  const uploadStream = bucket.openUploadStream(filename, {
    contentType,
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.end(buffer, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return {
    id: uploadStream.id.toString(),
    filename,
    length: uploadStream.length ?? buffer.length,
    uploadDate: uploadStream.uploadDate ?? new Date(),
    contentType,
  };
}

export async function openGridFsDownloadStream(fileId: string) {
  const bucket = await getBucket();
  const objectId = new ObjectId(fileId);
  return bucket.openDownloadStream(objectId);
}

