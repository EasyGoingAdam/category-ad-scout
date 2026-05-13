import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hunterVerifyEmail, hasHunterKey } from '@/lib/hunter';
import type { BrandRecord } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scanId = Number(params.id);
  if (!Number.isFinite(scanId)) {
    return NextResponse.json({ error: 'invalid scan id' }, { status: 400 });
  }
  if (!hasHunterKey()) {
    return NextResponse.json({ error: 'HUNTER_API_KEY required' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.brand_ids)
    ? body.brand_ids.map(Number).filter(Number.isFinite)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'brand_ids required' }, { status: 400 });
  }
  const db = sql();
  const brands = await db<BrandRecord[]>`
    SELECT id, best_email FROM brands
    WHERE scan_id = ${scanId} AND id IN ${db(ids)} AND best_email IS NOT NULL
  `;
  const log: string[] = [`Verifying ${brands.length} email(s) for scan #${scanId}`];

  let verified = 0;
  let invalid = 0;
  for (const b of brands) {
    try {
      const v = await hunterVerifyEmail(b.best_email!);
      await db`
        UPDATE brands SET
          email_verified_status = ${v.status},
          email_verified_score  = ${v.score | 0},
          email_verified_at     = NOW(),
          email_verified_raw    = ${JSON.stringify(v.raw ?? v)}
        WHERE id = ${b.id!}
      `;
      verified++;
      if (v.status === 'invalid' || v.status === 'disposable') invalid++;
      log.push(`${b.best_email}: ${v.status} · ${v.score}`);
    } catch (e: any) {
      log.push(`${b.best_email}: ${e?.message ?? e}`);
    }
  }
  return NextResponse.json({ verified, invalid, log });
}
