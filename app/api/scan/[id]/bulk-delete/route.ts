import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scanId = Number(params.id);
  if (!Number.isFinite(scanId)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.brand_ids)
    ? body.brand_ids.map(Number).filter(Number.isFinite)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'brand_ids required' }, { status: 400 });
  }
  const db = sql();
  await db`DELETE FROM brands WHERE scan_id = ${scanId} AND id IN ${db(ids)}`;
  return NextResponse.json({ deleted: ids.length });
}
