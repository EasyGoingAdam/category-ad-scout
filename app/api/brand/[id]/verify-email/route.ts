import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hunterVerifyEmail, hasHunterKey } from '@/lib/hunter';
import type { BrandRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  if (!hasHunterKey()) {
    return NextResponse.json({ error: 'HUNTER_API_KEY required' }, { status: 400 });
  }
  const db = sql();
  const body = await req.json().catch(() => ({}));
  // Allow override; otherwise use the persisted best_email
  const [b] = await db<BrandRecord[]>`SELECT * FROM brands WHERE id = ${id}`;
  if (!b) return NextResponse.json({ error: 'brand not found' }, { status: 404 });
  const email =
    typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : b.best_email;
  if (!email) {
    return NextResponse.json({ error: 'no email to verify on this brand' }, { status: 400 });
  }

  try {
    const v = await hunterVerifyEmail(email);
    await db`
      UPDATE brands SET
        email_verified_status = ${v.status},
        email_verified_score  = ${v.score | 0},
        email_verified_at     = NOW(),
        email_verified_raw    = ${JSON.stringify(v.raw ?? v)}
      WHERE id = ${id}
    `;
    return NextResponse.json({ brand_id: id, email, verify: v });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'verify failed' }, { status: 500 });
  }
}
