import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [{ ok }] = await sql()<{ ok: number }[]>`SELECT 1::int as ok`;
    return NextResponse.json({ ok: ok === 1, db: 'up' });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: 'down', error: e?.message ?? 'unknown' },
      { status: 503 },
    );
  }
}
