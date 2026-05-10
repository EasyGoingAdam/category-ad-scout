import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set([
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const updates: { user_status?: string | null; user_notes?: string | null } = {};
  if ('user_status' in body) {
    const s = body.user_status;
    if (s !== null && (typeof s !== 'string' || !ALLOWED_STATUSES.has(s))) {
      return NextResponse.json({ error: 'invalid user_status' }, { status: 400 });
    }
    updates.user_status = s;
  }
  if ('user_notes' in body) {
    updates.user_notes = typeof body.user_notes === 'string' ? body.user_notes : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }
  await sql()`
    UPDATE brands SET
      user_status = COALESCE(${updates.user_status ?? null}, user_status),
      user_notes  = COALESCE(${updates.user_notes ?? null},  user_notes),
      user_updated_at = NOW()
    WHERE id = ${id}
  `;
  // For explicit nulls (clearing), do a second pass
  if (updates.user_status === null) {
    await sql()`UPDATE brands SET user_status = NULL, user_updated_at = NOW() WHERE id = ${id}`;
  }
  if (updates.user_notes === null) {
    await sql()`UPDATE brands SET user_notes = NULL, user_updated_at = NOW() WHERE id = ${id}`;
  }
  const [row] = await sql()`SELECT * FROM brands WHERE id = ${id}`;
  return NextResponse.json({ brand: row });
}
