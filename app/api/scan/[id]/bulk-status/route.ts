import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'New',
  'Qualified',
  'Has Live Ads',
  'No Ads Found',
  'Needs Review',
  'Bad Fit',
  'Contact Found',
  'Contact Missing',
  'Contacted',
  'Replied',
  'Closed',
]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scanId = Number(params.id);
  if (!Number.isFinite(scanId)) return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.brand_ids) ? body.brand_ids.map(Number).filter(Number.isFinite) : [];
  const user_status = body?.user_status;
  if (ids.length === 0) return NextResponse.json({ error: 'brand_ids required' }, { status: 400 });
  if (user_status !== null && (typeof user_status !== 'string' || !ALLOWED.has(user_status))) {
    return NextResponse.json({ error: 'invalid user_status' }, { status: 400 });
  }
  const db = sql();
  await db`
    UPDATE brands
    SET user_status = ${user_status}, user_updated_at = NOW()
    WHERE scan_id = ${scanId} AND id IN ${db(ids)}
  `;
  return NextResponse.json({ updated: ids.length });
}
