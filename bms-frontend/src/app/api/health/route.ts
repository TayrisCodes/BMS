import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureUserIndexes } from '@/lib/auth/users';

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    await ensureUserIndexes(db);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed', error);
    return NextResponse.json(
      { status: 'error', message: 'Database connection failed' },
      { status: 500 },
    );
  }
}
