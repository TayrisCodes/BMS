import type { Collection, Db, IndexDescription, Document } from 'mongodb';
import { getDb } from '@/lib/db';

const OTP_CODES_COLLECTION_NAME = 'otpCodes';

export interface OtpCode {
  _id?: string;
  phone: string;
  code: string;
  expiresAt: Date;
  consumed: boolean;
  createdAt: Date;
}

const OTP_EXPIRY_MINUTES = 10;
const OTP_CODE_LENGTH = 6;
type OtpRecord = OtpCode & { _id: string };

export async function getOtpCodesCollection(): Promise<Collection<OtpCode>> {
  const db = await getDb();
  return db.collection<OtpCode>(OTP_CODES_COLLECTION_NAME);
}

export async function ensureOtpIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const collection = database.collection(OTP_CODES_COLLECTION_NAME);

  const indexes: IndexDescription[] = [
    // Index for finding active OTPs by phone
    {
      key: { phone: 1, consumed: 1, expiresAt: 1 },
      name: 'phone_consumed_expires',
    },
    // TTL index to auto-delete expired OTPs
    {
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
      name: 'expiresAt_ttl',
    },
  ];

  await collection.createIndexes(indexes);
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getOtpExpiryDate(): Date {
  const now = new Date();
  now.setMinutes(now.getMinutes() + OTP_EXPIRY_MINUTES);
  return now;
}

export async function createOtpCode(phone: string): Promise<OtpRecord> {
  const collection = await getOtpCodesCollection();

  // Invalidate any existing unconsumed OTPs for this phone
  await collection.updateMany(
    { phone: phone.trim(), consumed: false } as Document,
    { $set: { consumed: true } } as Document,
  );

  const code = generateOtpCode();
  const expiresAt = getOtpExpiryDate();
  const now = new Date();

  const doc: Omit<OtpCode, '_id'> = {
    phone: phone.trim(),
    code,
    expiresAt,
    consumed: false,
    createdAt: now,
  };

  const result = await collection.insertOne(doc);

  return {
    ...doc,
    _id: result.insertedId.toString(),
  } satisfies OtpRecord;
}

export async function findValidOtpCode(phone: string, code: string): Promise<OtpRecord | null> {
  const collection = await getOtpCodesCollection();
  const now = new Date();

  const result = await collection.findOne({
    phone: phone.trim(),
    code: code.trim(),
    consumed: false,
    expiresAt: { $gt: now },
  } as Document);

  if (!result) {
    return null;
  }

  const idValue = (result as { _id?: unknown })._id;
  const normalizedId =
    typeof idValue === 'string'
      ? idValue
      : typeof idValue === 'object' && idValue && 'toString' in idValue
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (idValue as any).toString()
        : undefined;

  if (!normalizedId) {
    return null;
  }

  return {
    ...result,
    _id: normalizedId,
  } satisfies OtpRecord;
}

export async function markOtpAsConsumed(otpId: string): Promise<void> {
  const collection = await getOtpCodesCollection();
  const { ObjectId } = await import('mongodb');

  await collection.updateOne(
    { _id: new ObjectId(otpId) } as Document,
    { $set: { consumed: true } } as Document,
  );
}

